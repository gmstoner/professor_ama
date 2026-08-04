import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SubmitInput = z.object({
  code: z.string().min(4).max(12),
  body: z.string().trim().min(5).max(280),
  token: z.string().min(8).max(64),
});

const VoteInput = z.object({
  questionId: z.string().uuid(),
  token: z.string().min(8).max(64),
});

export type SubmitResult =
  | { outcome: "accepted"; questionId: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "closed" };

export const submitQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data }): Promise<SubmitResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { moderateQuestion } = await import("./ama-moderation.server");

    const { data: session } = await supabaseAdmin
      .from("ama_session")
      .select("id, is_open")
      .eq("join_code", data.code.toUpperCase())
      .maybeSingle();

    if (!session || !session.is_open) return { outcome: "closed" };

    const verdict = await moderateQuestion(data.body);

    const { data: question, error } = await supabaseAdmin
      .from("ama_question")
      .insert({
        session_id: session.id,
        body: data.body,
        status: verdict.flagged ? "rejected" : "approved",
        moderation_reason: verdict.reason,
      })
      .select("id")
      .single();

    if (error || !question) throw new Error(error?.message ?? "Could not save question");

    await supabaseAdmin
      .from("ama_question_submitter")
      .insert({ question_id: question.id, submitter_token: data.token });

    if (verdict.flagged) {
      return { outcome: "rejected", reason: verdict.reason ?? "Flagged by moderation" };
    }
    return { outcome: "accepted", questionId: question.id };
  });

export type VoteResult = { voted: boolean; count: number } | { voted: false; count: number; locked: true };

export const toggleVote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VoteInput.parse(input))
  .handler(async ({ data }): Promise<VoteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: question } = await supabaseAdmin
      .from("ama_question")
      .select("id, status, upvote_count, ama_session!inner(is_open)")
      .eq("id", data.questionId)
      .maybeSingle();

    if (!question) throw new Error("Question not found");

    const sessionOpen = Array.isArray(question.ama_session)
      ? (question.ama_session[0]?.is_open ?? false)
      : ((question.ama_session as { is_open: boolean } | null)?.is_open ?? false);

    if (question.status !== "approved" || !sessionOpen) {
      return { voted: false, count: question.upvote_count, locked: true };
    }

    const { data: existing } = await supabaseAdmin
      .from("ama_vote")
      .select("id")
      .eq("question_id", data.questionId)
      .eq("voter_token", data.token)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("ama_vote").delete().eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("ama_vote")
        .insert({ question_id: data.questionId, voter_token: data.token });
    }

    const { count } = await supabaseAdmin
      .from("ama_vote")
      .select("id", { count: "exact", head: true })
      .eq("question_id", data.questionId);

    const total = count ?? 0;
    await supabaseAdmin
      .from("ama_question")
      .update({ upvote_count: total })
      .eq("id", data.questionId);

    return { voted: !existing, count: total };
  });

export const listMyVotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), token: z.string().min(8).max(64) }).parse(input),
  )
  .handler(async ({ data }): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ama_vote")
      .select("question_id, ama_question!inner(session_id)")
      .eq("voter_token", data.token)
      .eq("ama_question.session_id", data.sessionId);
    return (rows ?? []).map((r) => r.question_id);
  });

export const getMySubmissions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), token: z.string().min(8).max(64) }).parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<Array<{ id: string; body: string; status: string; moderation_reason: string | null }>> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("ama_question_submitter")
        .select("ama_question!inner(id, body, status, moderation_reason, session_id, created_at)")
        .eq("submitter_token", data.token)
        .eq("ama_question.session_id", data.sessionId);

      return (rows ?? [])
        .map((r) => r.ama_question as unknown as { id: string; body: string; status: string; moderation_reason: string | null })
        .filter(Boolean);
    },
  );
