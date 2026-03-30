/**
 * Auth store - manages authentication state
 */

import { writable, derived, get } from "svelte/store";
import { api, clearD1Bookmark, type Identity, type Device } from "../lib/api";
import { 
  loadMasterKey, 
  storeMasterKey, 
  clearMasterKey, 
  hasMasterKey,
  createStoredIdentityEncryptionKeyPair,
} from "../lib/crypto";
import { websocket } from "./websocket";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  identities: Identity[];
  currentIdentity: Identity | null;
  device: Device | null;
  masterKey: CryptoKey | null;
  hasMasterKey: boolean;
}

interface InitOptions {
  allowCookieSession?: boolean;
  timeoutMs?: number;
}

function hasStoredSessionToken(): boolean {
  try {
    return Boolean(localStorage.getItem("ave_session_token"));
  } catch {
    return false;
  }
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: hasStoredSessionToken(),
  userId: null,
  identities: [],
  currentIdentity: null,
  device: null,
  masterKey: null,
  hasMasterKey: false,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);
  let initPromise: Promise<void> | null = null;

  async function ensureIdentityEncryptionKeys(identities: Identity[], masterKey: CryptoKey | null) {
    if (!masterKey) return;

    for (const identity of identities) {
      try {
        const keyState = await api.encryption.getKey(identity.id);
        if (keyState.hasKey) continue;

        const generated = await createStoredIdentityEncryptionKeyPair(masterKey);
        await api.encryption.createKey(identity.id, generated);
      } catch (error) {
        console.warn("[Auth] Failed to backfill encryption key for identity", identity.id, error);
      }
    }
  }

  async function hydrateAuthenticatedSession(identities: Identity[]) {
    const masterKey = await loadMasterKey();

    update((s) => ({
      ...s,
      isAuthenticated: true,
      isLoading: false,
      identities,
      currentIdentity: identities.find((i) => i.isPrimary) || identities[0] || null,
      masterKey,
      hasMasterKey: masterKey !== null,
    }));

    void ensureIdentityEncryptionKeys(identities, masterKey);
  }
  
  return {
    subscribe,
    
    /**
     * Initialize auth state from storage
     */
    async init(options: InitOptions = {}) {
      if (initPromise) {
        return initPromise;
      }

      initPromise = (async () => {
      let token: string | null = null;
      try {
        token = localStorage.getItem("ave_session_token");
      } catch {
        token = null;
      }

      if (!token && !options.allowCookieSession) {
        update((s) => ({
          ...s,
          isAuthenticated: false,
          isLoading: false,
          userId: null,
          identities: [],
          currentIdentity: null,
          device: null,
          masterKey: null,
          hasMasterKey: false,
        }));
        return;
      }

      try {
        const identities = token
          ? (await api.identities.list()).identities
          : (await api.oauth.getSessionBootstrap(options.timeoutMs)).identities;

        await hydrateAuthenticatedSession(identities);

        if (token) {
          websocket.connectAsUser(token);
        }
      } catch {
        if (token) {
          try {
            localStorage.removeItem("ave_session_token");
          } catch {
          }
        }
        websocket.disconnect();
        update((s) => ({
          ...s,
          isAuthenticated: false,
          isLoading: false,
          userId: null,
          identities: [],
          currentIdentity: null,
          device: null,
          masterKey: null,
          hasMasterKey: false,
        }));
      }
      })();

      try {
        await initPromise;
      } finally {
        initPromise = null;
      }
    },
    
    /**
     * Login successfully
     */
    async login(
      sessionToken: string, 
      identities: Identity[], 
      device: Device,
      masterKey?: CryptoKey
    ) {
      localStorage.setItem("ave_session_token", sessionToken);
      
      if (masterKey) {
        await storeMasterKey(masterKey);
      }
      
      update((s) => ({
        ...s,
        isAuthenticated: true,
        isLoading: false,
        identities,
        currentIdentity: identities.find((i) => i.isPrimary) || identities[0] || null,
        device,
        masterKey: masterKey || null,
        hasMasterKey: masterKey !== null || hasMasterKey(),
      }));

      void ensureIdentityEncryptionKeys(identities, masterKey || null);
      
      // Connect WebSocket for real-time notifications
      websocket.connectAsUser(sessionToken);
    },
    
    /**
     * Set master key (after receiving from another device)
     */
    async setMasterKey(masterKey: CryptoKey) {
      await storeMasterKey(masterKey);
      update((s) => ({
        ...s,
        masterKey,
        hasMasterKey: true,
      }));
    },
    
    /**
     * Logout
     */
    async logout() {
      try {
        await api.login.logout();
      } catch {
        // Ignore errors during logout
      }
      
      clearD1Bookmark();
      localStorage.removeItem("ave_session_token");
      clearMasterKey();
      websocket.disconnect();
      set(initialState);
      update((s) => ({ ...s, isLoading: false }));
    },
    
    /**
     * Update identities
     */
    setIdentities(identities: Identity[]) {
      update((s) => ({
        ...s,
        identities,
        currentIdentity: s.currentIdentity 
          ? identities.find((i) => i.id === s.currentIdentity!.id) || identities[0]
          : identities.find((i) => i.isPrimary) || identities[0] || null,
      }));
    },
    
    /**
     * Switch current identity
     */
    setCurrentIdentity(identity: Identity) {
      update((s) => ({ ...s, currentIdentity: identity }));
    },
    
    /**
     * Update a single identity
     */
    updateIdentity(identity: Identity) {
      update((s) => ({
        ...s,
        identities: s.identities.map((i) => 
          i.id === identity.id ? identity : i
        ),
        currentIdentity: s.currentIdentity?.id === identity.id 
          ? identity 
          : s.currentIdentity,
      }));
    },
    
    /**
     * Add a new identity
     */
    addIdentity(identity: Identity) {
      update((s) => ({
        ...s,
        identities: [...s.identities, identity],
      }));
    },
    
    /**
     * Remove an identity
     */
    removeIdentity(identityId: string) {
      update((s) => {
        const identities = s.identities.filter((i) => i.id !== identityId);
        return {
          ...s,
          identities,
          currentIdentity: s.currentIdentity?.id === identityId
            ? identities.find((i) => i.isPrimary) || identities[0] || null
            : s.currentIdentity,
        };
      });
    },
  };
}

export const auth = createAuthStore();

// Derived stores for convenience
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
export const currentIdentity = derived(auth, ($auth) => $auth.currentIdentity);
export const identities = derived(auth, ($auth) => $auth.identities);
export const hasMasterKeyStore = derived(auth, ($auth) => $auth.hasMasterKey);
