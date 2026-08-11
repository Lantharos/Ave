export type AppScope =
  | "openid"
  | "profile"
  | "email"
  | "offline_access";

export const defaultScopes: AppScope[] = [
  "openid",
  "profile",
  "email",
  "offline_access",
];
