const DEFAULT_PROFESSOR_NAME = "Professor";
const DEFAULT_AMA_TITLE = "Classroom AMA";

function readEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Display name for the instructor (UI copy + avatar alt text). */
export const professorName = readEnv(
  import.meta.env.VITE_PROFESSOR_NAME as string | undefined,
  DEFAULT_PROFESSOR_NAME,
);

/** App / default session title. */
export const amaTitle = readEnv(
  import.meta.env.VITE_AMA_TITLE as string | undefined,
  DEFAULT_AMA_TITLE,
);

/** Optional avatar URL or public-path (e.g. `/avatar.jpg`). Empty = initials only. */
export const professorAvatarUrl = (
  (import.meta.env.VITE_PROFESSOR_AVATAR_URL as string | undefined) ?? ""
).trim();

/** Two-letter fallback for the avatar when no image is configured. */
export function professorInitials(name = professorName): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AMA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function brandDescription(name = professorName): string {
  return `Anonymous live Q&A for ${name}'s classroom sessions.`;
}
