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
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function mountAveEmbed(options: MountAveEmbedOptions): {
  iframe: HTMLIFrameElement;
  destroy: () => void;
  postMessage: (payload: unknown) => void;
};

export type OpenAveSheetOptions = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  theme?: AveTheme;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAveSheet(options: OpenAveSheetOptions): {
  close: () => void;
  iframe: HTMLIFrameElement;
};

export type OpenAvePopupOptions = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  theme?: AveTheme;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  width?: number;
  height?: number;
  onSuccess?: (payload: AveAuthSuccessPayload) => void;
  onError?: (payload: AveAuthErrorPayload) => void;
  onClose?: () => void;
};

export function openAvePopup(options: OpenAvePopupOptions): {
  popup: Window;
  close: () => void;
} | null;

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
