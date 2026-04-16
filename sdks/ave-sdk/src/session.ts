import { refreshAccessToken } from "./oauth-token.js";
import type { AveConfig, TokenResponse } from "./types.js";

export type AveSessionStatus = "signedOut" | "loading" | "signedIn";

export interface AveSessionSnapshot {
  access_token: string;
  access_token_jwt: string;
  id_token?: string;
  refresh_token?: string;
  expiresAtMs: number;
  scope?: string;
}

export interface AveSessionStorage {
  load(): Promise<AveSessionSnapshot | null>;
  save(snapshot: AveSessionSnapshot | null): Promise<void>;
}

export interface AveSessionOptions {
  oauth: AveConfig;
  storage: AveSessionStorage;
  /** Refresh this many ms before access JWT expiry. Default 5 minutes. */
  refreshSafetyMarginMs?: number;
  /**
   * If set, used instead of calling Ave's token endpoint directly.
   * Must return a JSON body compatible with TokenResponse on success.
   * Use for BFF patterns (HttpOnly refresh cookie).
   */
  customRefresh?: (args: {
    refreshToken?: string;
    previousSnapshot: AveSessionSnapshot | null;
  }) => Promise<TokenResponse>;
  fetch?: typeof fetch;
}

function jwtExpMs(jwt: string): number {
  const parts = jwt.split(".");
  if (parts.length < 2) return Date.now() + 3600_000;
  try {
    const normalized = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== "number") return Date.now() + 3600_000;
    return payload.exp * 1000;
  } catch {
    return Date.now() + 3600_000;
  }
}

function snapshotExpiresAtFromResponse(tr: TokenResponse): number {
  const jwt = tr.id_token || tr.access_token_jwt;
  return jwtExpMs(jwt);
}

/**
 * Build a persisted snapshot from a token response (code exchange or refresh).
 * Preserves `refresh_token` when the server omits it on rotation (reuse previous).
 */
export function snapshotFromTokenResponse(
  tr: TokenResponse,
  previous: AveSessionSnapshot | null
): AveSessionSnapshot {
  let refresh = tr.refresh_token;
  if (!refresh && previous?.refresh_token) {
    refresh = previous.refresh_token;
  }
  return {
    access_token: tr.access_token,
    access_token_jwt: tr.access_token_jwt,
    id_token: tr.id_token,
    refresh_token: refresh,
    expiresAtMs: snapshotExpiresAtFromResponse(tr),
    scope: tr.scope,
  };
}

type Listener = (state: { status: AveSessionStatus; snapshot: AveSessionSnapshot | null }) => void;

export class AveSession {
  private readonly oauth: AveConfig;
  private readonly storage: AveSessionStorage;
  private readonly marginMs: number;
  private readonly customRefresh?: AveSessionOptions["customRefresh"];
  private readonly fetchImpl: typeof fetch;

  private status: AveSessionStatus = "signedOut";
  private snapshot: AveSessionSnapshot | null = null;
  private hydrated = false;
  private refreshInFlight: Promise<void> | null = null;
  private listeners = new Set<Listener>();

  constructor(options: AveSessionOptions) {
    this.oauth = options.oauth;
    this.storage = options.storage;
    this.marginMs = options.refreshSafetyMarginMs ?? 5 * 60 * 1000;
    this.customRefresh = options.customRefresh;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  getState(): { status: AveSessionStatus; snapshot: AveSessionSnapshot | null } {
    return { status: this.status, snapshot: this.snapshot };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ status: this.status, snapshot: this.snapshot });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const payload = { status: this.status, snapshot: this.snapshot };
    for (const l of this.listeners) {
      l(payload);
    }
  }

  private setStatus(s: AveSessionStatus): void {
    this.status = s;
    this.emit();
  }

  /**
   * Load tokens from storage. Call once on app startup before authenticated work.
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.setStatus("loading");
    try {
      const raw = await this.storage.load();
      if (raw && raw.access_token_jwt && raw.access_token) {
        const effectiveExpiry =
          raw.expiresAtMs ||
          jwtExpMs((raw as { id_token?: string }).id_token || raw.access_token_jwt);
        this.snapshot = { ...raw, expiresAtMs: effectiveExpiry };
        this.setStatus("signedIn");
      } else {
        this.snapshot = null;
        this.setStatus("signedOut");
      }
    } catch {
      this.snapshot = null;
      this.setStatus("signedOut");
    }
    this.hydrated = true;
  }

  /**
   * Apply tokens from authorization code exchange (or FedCM). Persists before resolving.
   */
  async setTokensFromResponse(tr: TokenResponse): Promise<void> {
    const next = snapshotFromTokenResponse(tr, this.snapshot);
    this.snapshot = next;
    await this.storage.save(next);
    this.hydrated = true;
    this.setStatus("signedIn");
  }

  /**
   * Clear session locally. Does not revoke server-side tokens.
   */
  async signOut(): Promise<void> {
    this.snapshot = null;
    await this.storage.save(null);
    this.setStatus("signedOut");
    this.hydrated = false;
  }

  private needsProactiveRefresh(): boolean {
    if (!this.snapshot) return false;
    return Date.now() >= this.snapshot.expiresAtMs - this.marginMs;
  }

  private isExpired(): boolean {
    if (!this.snapshot) return true;
    return Date.now() >= this.snapshot.expiresAtMs;
  }

  private async runRefresh(): Promise<void> {
    const prev = this.snapshot;
    if (!prev?.refresh_token && !this.customRefresh) {
      await this.signOut();
      throw new Error("No refresh_token — request offline_access scope or sign in again");
    }

    let tr: TokenResponse;
    try {
      if (this.customRefresh) {
        tr = await this.customRefresh({
          refreshToken: prev?.refresh_token,
          previousSnapshot: prev,
        });
      } else {
        if (!prev?.refresh_token) {
          await this.signOut();
          throw new Error("No refresh_token");
        }
        tr = await refreshAccessToken(this.oauth, { refreshToken: prev.refresh_token }, this.fetchImpl);
      }
    } catch {
      await this.signOut();
      throw new Error("Session refresh failed — sign in again");
    }

    const next = snapshotFromTokenResponse(tr, prev);
    this.snapshot = next;
    await this.storage.save(next);
    this.emit();
  }

  /**
   * Ensures a single in-flight refresh; concurrent callers await the same work.
   */
  private async ensureFresh(): Promise<void> {
    if (!this.snapshot) {
      throw new Error("Not signed in");
    }
    if (!this.needsProactiveRefresh() && !this.isExpired()) {
      return;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.runRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    await this.refreshInFlight;
  }

  /**
   * Returns a JWT suitable for Convex `setAuth` — always the id_token, refreshed if needed.
   */
  async getValidIdToken(): Promise<string | null> {
    await this.hydrate();
    if (this.status !== "signedIn" || !this.snapshot) {
      return null;
    }
    await this.ensureFresh();
    const id = this.snapshot.id_token;
    if (!id) {
      throw new Error(
        "No id_token in session — include the openid scope when authorizing"
      );
    }
    return id;
  }

  /**
   * Bearer token for Ave APIs (UserInfo, etc.).
   */
  async getValidAccessToken(): Promise<string | null> {
    await this.hydrate();
    if (this.status !== "signedIn" || !this.snapshot) {
      return null;
    }
    await this.ensureFresh();
    return this.snapshot.access_token;
  }
}
