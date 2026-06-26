export const OAUTH_PROMPT_VALUES = [
  "none",
  "login",
  "consent",
  "select_account",
] as const;

export type OAuthPrompt = (typeof OAUTH_PROMPT_VALUES)[number];

export function parseOAuthPrompt(value: string | null | undefined): OAuthPrompt[] {
  if (!value?.trim()) {
    return [];
  }

  const prompts = value
    .replace(/\+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return prompts.filter((part): part is OAuthPrompt =>
    (OAUTH_PROMPT_VALUES as readonly string[]).includes(part),
  );
}

export function formatOAuthPrompt(
  prompt: OAuthPrompt | OAuthPrompt[] | string,
): string {
  if (Array.isArray(prompt)) {
    return prompt.join(" ");
  }
  return prompt.trim();
}

export function requiresAuthorizeInteractionPrompt(
  prompts: readonly string[],
): boolean {
  return prompts.includes("select_account") || prompts.includes("consent");
}

export function wantsAccountPickerPrompt(prompts: readonly string[]): boolean {
  return prompts.includes("select_account");
}
