import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeading } from "@/components/BrandHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { makeJoinCode, SEED_QUESTIONS } from "@/lib/ama-device";
import { amaTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Instructor dashboard — ${amaTitle}` },
      {
        name: "description",
        content: "Run a live AMA session: share the QR code, moderate and answer questions.",
      },
      { property: "og:title", content: `Instructor dashboard — ${amaTitle}` },
      { property: "og:description", content: "Run a live classroom AMA session." },
    ],
  }),
  component: Dashboard,
});

type Session = {
  id: string;
  title: string;
  join_code: string;
  is_open: boolean;
  created_at: string;
};

type Question = {
  id: string;
  body: string;
  status: string;
  moderation_reason: string | null;
  upvote_count: number;
  is_seed: boolean;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState(amaTitle);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bigQr, setBigQr] = useState(false);

  const joinUrl = useMemo(() => {
    if (!session || typeof window === "undefined") return "";
    return `${window.location.origin}/j/${session.join_code}`;
  }, [session]);

  const loadQuestions = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("ama_question")
      .select("id, body, status, moderation_reason, upvote_count, is_seed, created_at")
      .eq("session_id", sessionId)
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: true });
    setQuestions((data ?? []) as Question[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ama_session")
        .select("id, title, join_code, is_open, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = (data?.[0] ?? null) as Session | null;
      setSession(latest);
      if (latest) await loadQuestions(latest.id);
      setLoading(false);
    })();
  }, [loadQuestions]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`ama-instructor-${session.id}`)
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

  async function createSession() {
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("ama_session")
        .insert({
          instructor_id: user.user.id,
          title: title.trim() || amaTitle,
          join_code: makeJoinCode(),
        })
        .select("id, title, join_code, is_open, created_at")
        .single();
      if (error) throw error;

      const { error: seedError } = await supabase.from("ama_question").insert(
        SEED_QUESTIONS.map((body) => ({
          session_id: data.id,
          body,
          status: "approved",
          is_seed: true,
        })),
      );
      if (seedError) throw seedError;

      setSession(data as Session);
      await loadQuestions(data.id);
      toast.success("Session open — share the QR code");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create session");
    } finally {
      setBusy(false);
    }
  }

  async function setOpen(isOpen: boolean) {
    if (!session) return;
    const { data, error } = await supabase
      .from("ama_session")
      .update({ is_open: isOpen, closed_at: isOpen ? null : new Date().toISOString() })
      .eq("id", session.id)
      .select("id, title, join_code, is_open, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSession(data as Session);
    toast.success(isOpen ? "Session reopened" : "Session closed");
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from("ama_question")
      .update({ status, answered_at: status === "answered" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (session) await loadQuestions(session.id);
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const live = questions.filter((q) => q.status === "approved");
  const answered = questions.filter((q) => q.status === "answered");
  const declined = questions.filter((q) => q.status === "declined");
  const blocked = questions.filter((q) => q.status === "rejected");

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (bigQr && session) {
    return (
      <button
        type="button"
        onClick={() => setBigQr(false)}
        className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background p-8"
      >
        <h1 className="text-3xl font-bold">{session.title}</h1>
        <p className="text-muted-foreground">Scan to ask a question — anonymously</p>
        <div className="rounded-2xl bg-card p-8 shadow-sm">
          <QRCodeSVG value={joinUrl} size={420} level="M" />
        </div>
        <p className="font-display text-5xl tracking-[0.3em]">{session.join_code}</p>
        <p className="text-xs text-muted-foreground">Click anywhere to exit</p>
      </button>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Instructor</p>
          <BrandHeading size="md" />
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      {!session || !session.is_open ? (
        <section className="ama-card space-y-4 p-5">
          <h2 className="text-lg font-semibold">
            {session ? "Session closed" : "Start a session"}
          </h2>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={createSession} disabled={busy}>
              {busy ? "Creating…" : "Start new session"}
            </Button>
            {session ? (
              <Button variant="outline" onClick={() => setOpen(true)}>
                Reopen {session.join_code}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Questions can only be submitted or upvoted while a session is open.
          </p>
        </section>
      ) : (
        <section className="ama-card flex flex-wrap items-center gap-6 p-5">
          <div className="rounded-xl border border-border p-3">
            <QRCodeSVG value={joinUrl} size={120} level="M" />
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">Join code</p>
            <p className="font-display text-3xl tracking-[0.25em]">{session.join_code}</p>
            <p className="truncate text-xs text-muted-foreground">{joinUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setBigQr(true)}>Show on screen</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close session
            </Button>
          </div>
        </section>
      )}

      {session ? (
        <>
          <QuestionGroup
            heading={`Live questions (${live.length})`}
            questions={live}
            actions={(q) => (
              <>
                <Button size="sm" onClick={() => setStatus(q.id, "answered")}>
                  Answered
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(q.id, "declined")}>
                  Decline
                </Button>
              </>
            )}
            empty="No questions yet — students' questions appear here instantly."
          />

          <QuestionGroup
            heading={`Answered (${answered.length})`}
            questions={answered}
            actions={(q) => (
              <Button size="sm" variant="outline" onClick={() => setStatus(q.id, "approved")}>
                Reopen
              </Button>
            )}
          />

          <QuestionGroup
            heading={`Declined (${declined.length})`}
            questions={declined}
            actions={(q) => (
              <Button size="sm" variant="outline" onClick={() => setStatus(q.id, "approved")}>
                Restore
              </Button>
            )}
          />

          <QuestionGroup
            heading={`Blocked by moderation (${blocked.length})`}
            questions={blocked}
            note
          />
        </>
      ) : null}
    </main>
  );
}

function QuestionGroup({
  heading,
  questions,
  actions,
  empty,
  note,
}: {
  heading: string;
  questions: Question[];
  actions?: (q: Question) => React.ReactNode;
  empty?: string;
  note?: boolean;
}) {
  if (!questions.length && !empty) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h2>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="ama-card flex items-start gap-4 p-4">
              <div className="flex min-w-12 flex-col items-center rounded-md bg-secondary px-2 py-1">
                <span className="font-display text-lg leading-none text-secondary-foreground">
                  {q.upvote_count}
                </span>
                <span className="text-[10px] uppercase text-secondary-foreground">votes</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm leading-snug">{q.body}</p>
                {note && q.moderation_reason ? (
                  <p className="text-xs text-destructive">{q.moderation_reason}</p>
                ) : null}
                {q.is_seed ? (
                  <p className="text-xs text-muted-foreground">Seeded starter question</p>
                ) : null}
              </div>
              {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions(q)}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
