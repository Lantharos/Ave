export type AppScope =
  | "openid"
  | "profile"
  | "email"
  | "offline_access"
  | "user_id";

export const defaultScopes: AppScope[] = [
  "openid",
  "profile",
  "email",
  "offline_access",
];

export const scopeDescriptions: Record<AppScope, string> = {
  openid: "Basic identity token",
  profile: "Display name and avatar",
  email: "Email address",
  offline_access: "Refresh tokens",
  user_id: "Persistent user identifier",
};
