export type AveTheme = string;

export type AveAuthSuccessPayload = {
  redirectUrl: string;
  [key: string]: unknown;
};

export type AveAuthErrorPayload = {
  error: string;
  message?: string;
  [key: string]: unknown;
};

export type AveTokenResponse = {
  access_token: string;
  access_token_jwt: string;
  id_token?: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  user_id?: string;
  user?: {
    id: string;
    handle: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
  } | null;
};

export type AveSigningSignedPayload = {
  [key: string]: unknown;
};

export type AveSigningDeniedPayload = {
  [key: string]: unknown;
};

export type MountAveEmbedOptions = {
  container: HTMLElement;
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  theme?: AveTheme;
  width?: string;
  height?: number | string;
  /** Receive tokens directly — PKCE is handled automatically. Use instead of onSuccess. */
  onTokens?: (tokens: AveTokenResponse) => void;
  /** Legacy: receives { redirectUrl } — exchange the code manually. Use onTokens for the simpler path. */
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function mountAveEmbed(options: MountAveEmbedOptions): Promise<{
  iframe: HTMLIFrameElement;
  destroy: () => void;
  postMessage: (payload: unknown) => void;
}>;

export type OpenAveSheetOptions = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  theme?: AveTheme;
  /** Only used when onTokens is not provided. */
  codeChallenge?: string;
  /** Only used when onTokens is not provided. */
  codeChallengeMethod?: string;
  extraParams?: Record<string, string>;
  /** Receive tokens directly — PKCE is handled automatically. Use instead of onSuccess. */
  onTokens?: (tokens: AveTokenResponse) => void;
  /** Legacy: receives { redirectUrl } — exchange the code manually. Use onTokens for the simpler path. */
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAveSheet(options: OpenAveSheetOptions): Promise<{
  close: () => void;
  iframe: HTMLIFrameElement;
}>;

export type OpenAvePopupOptions = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  theme?: AveTheme;
  /** Only used when onTokens is not provided. */
  codeChallenge?: string;
  /** Only used when onTokens is not provided. */
  codeChallengeMethod?: string;
  width?: number;
  height?: number;
  /** Receive tokens directly — PKCE is handled automatically. Use instead of onSuccess. */
  onTokens?: (tokens: AveTokenResponse) => void;
  /** Legacy: receives { redirectUrl } — exchange the code manually. Use onTokens for the simpler path. */
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAvePopup(options: OpenAvePopupOptions): Promise<{
  popup: Window;
  close: () => void;
} | null>;

export type StartAveAuthOptions =
  | (Omit<MountAveEmbedOptions, "clientId"> & { clientId?: string })
  | (Omit<OpenAveSheetOptions, "clientId"> & { clientId?: string });

export function startAveAuth(options: StartAveAuthOptions): Promise<
  | {
      iframe: HTMLIFrameElement;
      destroy: () => void;
      postMessage: (payload: unknown) => void;
    }
  | {
      close: () => void;
      iframe: HTMLIFrameElement;
    }
>;

export type OpenAveConnectorOptions = {
  clientId: string;
  redirectUri: string;
  resource: string;
  scope?: string;
  mode?: "user_present" | "background";
  issuer?: string;
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAveConnectorSheet(options: OpenAveConnectorOptions): {
  close: () => void;
  iframe: HTMLIFrameElement;
};

export function openAveConnectorPopup(options: OpenAveConnectorOptions & { width?: number; height?: number }): {
  popup: Window;
  close: () => void;
} | null;

export type OpenAveConnectorRuntimeOptions = {
  issuer?: string;
  target?: string;
  targetOrigin?: string;
  delegatedToken: string;
  mode?: "user_present" | "background";
  width?: string;
  height?: number | string;
  container?: HTMLElement;
  onReady?: () => void;
  onEvent?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
};

export function openAveConnectorRuntime(options: OpenAveConnectorRuntimeOptions): {
  iframe: HTMLIFrameElement;
  send: (payload: unknown) => void;
  destroy: () => void;
};

export type OpenAveSigningSheetOptions = {
  requestId: string;
  issuer?: string;
  onSigned?: (payload: AveSigningSignedPayload) => void;
  onDenied?: (payload: AveSigningDeniedPayload) => void;
  onClose?: () => void;
};

export function openAveSigningSheet(options: OpenAveSigningSheetOptions): {
  close: () => void;
  iframe: HTMLIFrameElement;
};

export type OpenAveSigningPopupOptions = {
  requestId: string;
  issuer?: string;
  width?: number;
  height?: number;
  onSigned?: (payload: AveSigningSignedPayload) => void;
  onDenied?: (payload: AveSigningDeniedPayload) => void;
  onClose?: () => void;
};

export function openAveSigningPopup(options: OpenAveSigningPopupOptions): {
  popup: Window;
  close: () => void;
} | null;

export type OpenIrisDelegatedRuntimeOptions = {
  issuer?: string;
  targetOrigin?: string;
  delegatedToken: string;
  mode?: "user_present" | "background";
  width?: string;
  height?: number | string;
  container?: HTMLElement;
  onReady?: () => void;
  onEvent?: (payload: unknown) => void;
  onError?: (payload: unknown) => void;
};

export function openIrisDelegatedRuntime(options: OpenIrisDelegatedRuntimeOptions): {
  iframe: HTMLIFrameElement;
  send: (payload: unknown) => void;
  destroy: () => void;
};

export type AveAppKeyClaimSuccessPayload = {
  kind: "app_key_claim";
  redirectUrl: string | null;
  sharedSecretId: string;
  transferId: string;
  identityId: string;
  handle: string;
};

export type AveAppKeyClaimDeferredSuccessPayload = {
  kind: "app_key_claim_deferred";
  claimToken: string;
  redirectUrl: string | null;
  sharedSecretId: string;
  transferId: string;
  identityId: string;
  handle: string;
};

export type OpenAppKeyClaimOptions = {
  /** Raw token from `claimToken` in the transfer API response */
  claimToken?: string;
  /** Full claim URL from the API (embed=1 is appended automatically) */
  claimUrl?: string;
  issuer?: string;
  /**
   * When `citadel_v1`, the claim page re-wraps the secret with HKDF(salt `citadel:ss:${resourceKey}`, IKM = OAuth app key)
   * so it matches app-side `wrapForRecipientStorage`. Requires `appKeyB64` or an equivalent postMessage from the host.
   */
  finalizeRecipientWrap?: "master" | "citadel_v1";
  /** If true, claim URL gets `defer_finalize=1` — Ave authenticates and decrypts but the host must call claim + finalize via the SDK. */
  deferFinalize?: boolean;
  /** Overrides the shared secret `resourceKey` for the citadel_v1 salt when the claim URL should pin it explicitly. */
  sharedSecretResourceKey?: string;
  /** Plaintext OAuth app key (base64). When set with `finalizeRecipientWrap: "citadel_v1"`, the embed posts `ave:provide_app_key` into the iframe/popup after load. */
  appKeyB64?: string;
  onSuccess?: (payload: AveAppKeyClaimSuccessPayload | AveAppKeyClaimDeferredSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAppKeyClaimSheet(
  options: OpenAppKeyClaimOptions
): {
  close: () => void;
  iframe: HTMLIFrameElement;
};

export type OpenAppKeyClaimPopupOptions = OpenAppKeyClaimOptions & {
  width?: number;
  height?: number;
};

export function openAppKeyClaimPopup(
  options: OpenAppKeyClaimPopupOptions
): {
  popup: Window;
  close: () => void;
} | null;
