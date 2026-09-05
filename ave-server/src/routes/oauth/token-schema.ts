import { z } from "zod";
import { normalizeOauthTokenPayload } from "./shared";

export const oauthTokenRequestSchema = z.preprocess(
  normalizeOauthTokenPayload,
  z.discriminatedUnion("grantType", [
    z.object({
      grantType: z.literal("authorization_code"),
      code: z.string(),
      redirectUri: z.string().url(),
      clientId: z.string(),
      clientSecret: z.string().optional(),
      codeVerifier: z.string().optional(),
    }),
    z.object({
      grantType: z.literal("refresh_token"),
      refreshToken: z.string(),
      clientId: z.string(),
      clientSecret: z.string().optional(),
    }),
    z.object({
      grantType: z.literal("urn:ietf:params:oauth:grant-type:token-exchange"),
      subjectToken: z.string(),
      requestedResource: z.string(),
      requestedScope: z.string(),
      clientId: z.string(),
      clientSecret: z.string().optional(),
      actor: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
);

type OAuthTokenRequest = z.infer<typeof oauthTokenRequestSchema>;

export type AuthorizationCodeRequest = Extract<OAuthTokenRequest, { grantType: "authorization_code" }>;
export type RefreshTokenRequest = Extract<OAuthTokenRequest, { grantType: "refresh_token" }>;
export type TokenExchangeRequest = Extract<
  OAuthTokenRequest,
  { grantType: "urn:ietf:params:oauth:grant-type:token-exchange" }
>;
