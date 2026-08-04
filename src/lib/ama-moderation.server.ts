export type ModerationVerdict = {
  flagged: boolean;
  reason: string | null;
};

const LABELS: Record<string, string> = {
  harassment: "harassment",
  "harassment/threatening": "threatening harassment",
  hate: "hate speech",
  "hate/threatening": "threatening hate speech",
  sexual: "sexual content",
  "sexual/minors": "sexual content involving minors",
  violence: "violence",
  "violence/graphic": "graphic violence",
  "self-harm": "self-harm",
  "self-harm/intent": "self-harm intent",
  "self-harm/instructions": "self-harm instructions",
  illicit: "illicit behavior",
  "illicit/violent": "violent illicit behavior",
};

/**
 * Classroom AMA policy for gpt-4o-mini.
 * Personal get-to-know-you questions are encouraged; sexuality/dating/body topics are not.
 */
const CLASSROOM_POLICY_PROMPT = `You classify student questions for a live classroom AMA whose purpose is building trust between students and their professor.

Students SHOULD ask personal questions that help them get to know the professor as a person or professional. "Personal" means biography, career, hobbies, values, and lighthearted icebreakers — NOT sexuality, dating, romance, or sexualized body topics.

ALLOW questions about:
- Background and biography (hometown, family at a high level, upbringing, education path)
- Career and teaching (why this field, path into teaching, advice, favorite topics)
- Hobbies, pets, travel, food, sports, music, books, favorite places
- Values, work habits, communication style, what a good semester looks like
- Lighthearted non-sexual icebreakers
- Course or logistics questions that belong in a live AMA

REJECT questions about:
- Sexual activity, sexual innuendo, sleeping with anyone, hookups, pornography
- Dating, romantic relationships, crushes, or attraction involving the professor, their partner, or students
- Sexualized body or anatomy questions (genitals, bedroom questions, objectifying appearance)
- Rating attractiveness in a sexual or objectifying way
- Harassment, insults, hate, threats, graphic violence, self-harm
- Doxxing or fishing for private contact details
- Spam or gibberish

When borderline: reject sexual/dating/body topics; allow ordinary personal get-to-know-you topics.
If rejected, reason must be short, neutral, and student-facing (e.g. "Not appropriate for class"). Do not restate crude content.

Respond with ONLY valid JSON (no markdown): {"allowed": boolean, "reason": string | null}
reason is null when allowed.`;

type ClassroomVerdict = {
  allowed: boolean;
  reason: string | null;
};

async function runOpenAiModeration(apiKey: string, text: string): Promise<ModerationVerdict> {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("moderation request failed", res.status, detail);
    return { flagged: true, reason: "Moderation check unavailable" };
  }

  const json = (await res.json()) as {
    results?: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
  };
  const result = json.results?.[0];
  if (!result) return { flagged: true, reason: "Moderation check unavailable" };
  if (!result.flagged) return { flagged: false, reason: null };

  const hits = Object.entries(result.categories)
    .filter(([, on]) => on)
    .map(([key]) => LABELS[key] ?? key);

  return {
    flagged: true,
    reason: hits.length ? `Flagged for ${hits.join(", ")}` : "Flagged by moderation",
  };
}

function parseClassroomJson(raw: string): ClassroomVerdict | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as { allowed?: unknown; reason?: unknown };
    if (typeof parsed.allowed !== "boolean") return null;
    const reason =
      parsed.reason === null || parsed.reason === undefined
        ? null
        : typeof parsed.reason === "string"
          ? parsed.reason
          : null;
    return { allowed: parsed.allowed, reason };
  } catch {
    return null;
  }
}

async function classifyClassroomAppropriateness(
  apiKey: string,
  text: string,
): Promise<ModerationVerdict> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLASSROOM_POLICY_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("classroom moderation request failed", res.status, detail);
    return { flagged: true, reason: "Moderation check unavailable" };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return { flagged: true, reason: "Moderation check unavailable" };

  const verdict = parseClassroomJson(content);
  if (!verdict) {
    console.error("classroom moderation parse failed", content);
    return { flagged: true, reason: "Moderation check unavailable" };
  }

  if (verdict.allowed) return { flagged: false, reason: null };
  return {
    flagged: true,
    reason: verdict.reason?.trim() || "Not appropriate for class",
  };
}

/**
 * Moderates a question with OpenAI Moderation, then a classroom-appropriateness check.
 * Fails closed on API errors so nothing unreviewed slips through.
 */
export async function moderateQuestion(text: string): Promise<ModerationVerdict> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    return { flagged: true, reason: "Moderation is not configured" };
  }

  try {
    const safety = await runOpenAiModeration(apiKey, text);
    if (safety.flagged) return safety;
    return await classifyClassroomAppropriateness(apiKey, text);
  } catch (error) {
    console.error("moderation error", error);
    return { flagged: true, reason: "Moderation check unavailable" };
  }
}
