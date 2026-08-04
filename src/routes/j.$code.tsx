import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrandHeading } from "@/components/BrandHeading";
import { getDeviceToken } from "@/lib/ama-device";
import { submitQuestion, toggleVote, listMyVotes, getMySubmissions } from "@/lib/ama.functions";
import { professorName } from "@/lib/brand";

export const Route = createFileRoute("/j/$code")({
  head: () => ({
    meta: [
      { title: `Join the AMA — ${professorName}` },
      {
        name: "description",
        content: "Submit a question anonymously and upvote the ones you want answered in class.",
      },
      { property: "og:title", content: `Join the AMA — ${professorName}` },
      { property: "og:description", content: "Ask anything, anonymously, during class." },
    ],
  }),
  component: StudentPage,
});

type Question = {
  id: string;
  body: string;
  status: string;
  upvote_count: number;
  created_at: string;
};

type Submission = { id: string; body: string; status: string; moderation_reason: string | null };

function StudentPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [mine, setMine] = useState<Submission[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useMemo(() => getDeviceToken(), []);

  const loadQuestions = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("ama_question")
      .select("id, body, status, upvote_count, created_at")
      .eq("session_id", sessionId)
      .in("status", ["approved", "answered"])
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: true });
    setQuestions((data ?? []) as Question[]);
  }, []);

  const loadMine = useCallback(
    async (sessionId: string) => {
      const rows = await getMySubmissions({ data: { sessionId, token } });
      setMine(rows);
    },
    [token],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ama_session")
        .select("id, title")
        .eq("join_code", code.toUpperCase())
        .eq("is_open", true)
        .maybeSingle();

      if (!data) {
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(data);
      await loadQuestions(data.id);
      const votes = await listMyVotes({ data: { sessionId: data.id, token } });
      setVoted(new Set(votes));
      await loadMine(data.id);
      setLoading(false);
    })();
  }, [code, token, loadQuestions, loadMine]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`ama-student-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ama_question", filter: `session_id=eq.${session.id}` },
        () => {
          void loadQuestions(session.id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadQuestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const text = body.trim();
    if (text.length < 5) {
      toast.error("Add a little more detail");
      return;
    }
    setBusy(true);
    try {
      const result = await submitQuestion({ data: { code: code.toUpperCase(), body: text, token } });
      if (result.outcome === "accepted") {
        toast.success("Question posted anonymously");
        setBody("");
      } else if (result.outcome === "rejected") {
        toast.error(`Not posted: ${result.reason}`);
        setBody("");
      } else {
        toast.error("This session is closed");
      }
      await loadQuestions(session.id);
      await loadMine(session.id);
    } catch {
      toast.error("Could not submit your question");
    } finally {
      setBusy(false);
    }
  }

  async function handleVote(id: string) {
    if (!session) return;
    try {
      const result = await toggleVote({ data: { questionId: id, token } });
      if ("locked" in result) {
        toast.error("This question can no longer be upvoted");
      } else {
        setVoted((prev) => {
          const next = new Set(prev);
          if (result.voted) next.add(id);
          else next.delete(id);
          return next;
        });
      }
      await loadQuestions(session.id);
    } catch {
      toast.error("Could not register your vote");
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-bold">Session not open</h1>
        <p className="text-sm text-muted-foreground">
          Questions can only be asked in class while {professorName} has the session open.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-5 py-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Anonymous</p>
        <BrandHeading title={session.title} size="md" />
        <p className="text-sm text-muted-foreground">
          Your name is never attached to anything you send.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question…"
          maxLength={280}
          rows={3}
          className="resize-none text-base"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{body.length}/280</span>
          <Button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Submit"}
          </Button>
        </div>
      </form>

      {mine.some((m) => m.status === "rejected") ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="text-sm font-semibold text-destructive">Not posted</h2>
          <ul className="mt-2 space-y-2">
            {mine
              .filter((m) => m.status === "rejected")
              .map((m) => (
                <li key={m.id} className="text-xs text-muted-foreground">
                  <span className="block text-foreground">{m.body}</span>
                  {m.moderation_reason}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Questions
        </h2>
        <ul className="space-y-2">
          {questions.map((q) => {
            const isAnswered = q.status === "answered";
            const hasVoted = voted.has(q.id);
            return (
              <li key={q.id} className="ama-card flex items-center gap-3 p-3">
                <button
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleVote(q.id)}
                  aria-label={hasVoted ? "Remove upvote" : "Upvote question"}
                  className={`flex min-w-12 flex-col items-center rounded-md border px-2 py-1.5 transition-colors ${
                    isAnswered
                      ? "border-border bg-muted text-muted-foreground"
                      : hasVoted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary"
                  }`}
                >
                  {isAnswered ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                  <span className="font-display text-sm leading-none">{q.upvote_count}</span>
                </button>
                <div className="flex-1">
                  <p className={`text-sm leading-snug ${isAnswered ? "text-muted-foreground" : ""}`}>
                    {q.body}
                  </p>
                  {isAnswered ? (
                    <p className="mt-0.5 text-xs font-medium text-primary">Answered in class</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
