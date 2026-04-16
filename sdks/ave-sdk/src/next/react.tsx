"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import type { AveSessionOptions } from "../session.js";
import { AveSession, type AveSessionSnapshot, type AveSessionStatus } from "../session.js";
import { wireAveSessionToConvex } from "../convex.js";

export interface AveSessionContextValue {
  session: AveSession;
  status: AveSessionStatus;
  snapshot: AveSessionSnapshot | null;
  /** True after initial `hydrate()` finished (success or signed out). */
  isHydrated: boolean;
}

const Ctx = createContext<AveSessionContextValue | null>(null);

export interface AveSessionProviderProps {
  options: AveSessionOptions;
  children: ReactNode;
}

/**
 * Next.js App Router: wraps the subtree with a stable **`AveSession`**, runs **`hydrate()`** on mount, and subscribes to session updates.
 *
 * Pass **`options`** from **`useMemo`** so the **`AveSession`** constructor is not recreated every render:
 *
 * ```tsx
 * const options = useMemo(() => ({
 *   oauth: { clientId: process.env.NEXT_PUBLIC_AVE_CLIENT_ID!, redirectUri },
 *   storage: createLocalStorageAdapter(),
 * }), [redirectUri]);
 * ```
 */
export function AveSessionProvider({ options, children }: AveSessionProviderProps): ReactElement {
  const session = useMemo(() => new AveSession(options), [options]);

  const [status, setStatus] = useState<AveSessionStatus>("loading");
  const [snapshot, setSnapshot] = useState<AveSessionSnapshot | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsub = session.subscribe((s) => {
      if (!alive) return;
      setStatus(s.status);
      setSnapshot(s.snapshot);
    });
    void session
      .hydrate()
      .finally(() => {
        if (alive) setIsHydrated(true);
      });
    return () => {
      alive = false;
      unsub();
    };
  }, [session]);

  const value = useMemo(
    () => ({ session, status, snapshot, isHydrated }),
    [session, status, snapshot, isHydrated]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAveSession(): AveSessionContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("[Ave] useAveSession must be used within AveSessionProvider");
  }
  return v;
}

interface ConvexLike {
  setAuth(fetchToken: () => Promise<string | null | undefined>): void | (() => void);
}

export interface AveConvexProviderProps {
  client: ConvexLike;
  children: ReactNode;
}

/**
 * Calls **`wireAveSessionToConvex`** when the session is available. Place **inside** **`AveSessionProvider`**, wrapping **`ConvexProvider`** children or alongside it.
 */
export function AveConvexBridge({ client, children }: AveConvexProviderProps): ReactElement {
  const { session } = useAveSession();
  useEffect(() => {
    wireAveSessionToConvex(client, session);
  }, [client, session]);
  return <>{children}</>;
}
