const KEY = "ama_device_token";

export function getDeviceToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(KEY, token);
  }
  return token;
}

export function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const SEED_QUESTIONS = [
  "Where did you grow up?",
  "What is your favorite place to vote?",
  "What's your favorite type of pet?",
];
