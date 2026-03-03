export type AveAuthResult = {
  sessionToken: string;
  identityId: string;
  expiresAtEpochMs: number;
};

export type AveAuthOptions = {
  scope?: string;
  interactive?: boolean;
  browserFallbackUrl?: string;
};
