export type AppScope = "openid" | "profile" | "email" | "offline_access" | "user_id";

export const defaultScopes: AppScope[] = ["openid", "profile", "email", "offline_access"];
