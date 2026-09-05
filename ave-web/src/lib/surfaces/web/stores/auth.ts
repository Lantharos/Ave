/**
 * Auth store - manages authentication state
 */

import { derived, get, writable } from "svelte/store";
import { api, ApiError, clearD1Bookmark, type Identity, type LoginSession } from "../lib/api";
import {
  clearMasterKey,
  createStoredIdentityEncryptionKeyPair,
  selectMasterKeyAccount,
  storeMasterKey,
} from "../lib/crypto";
import { queuePasskeySetupPrompt } from "../lib/passkey-setup-prompt";
import { resolveSessionMasterKey } from "../lib/session-master-key";
import { websocket } from "./websocket";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isReadOnly: boolean;
  identities: Identity[];
  currentIdentity: Identity | null;
  device: LoginSession["device"] | null;
  masterKey: CryptoKey | null;
  hasMasterKey: boolean;
}

interface InitOptions {
  timeoutMs?: number;
}

interface LoginOptions {
  isReadOnly?: boolean;
  offerPasskeySetup?: boolean;
  preserveCurrentIdentity?: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  isReadOnly: false,
  identities: [],
  currentIdentity: null,
  device: null,
  masterKey: null,
  hasMasterKey: false,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);
  let initPromise: Promise<void> | null = null;
  let sessionRevision = 0;

  async function ensureIdentityEncryptionKeys(identities: Identity[], masterKey: CryptoKey | null, revision: number) {
    if (!masterKey) return;

    const missingKeys = identities.filter((identity) => identity.hasEncryptionKey === false);
    for (const identity of missingKeys) {
      try {
        const generated = await createStoredIdentityEncryptionKeyPair(masterKey);
        if (revision !== sessionRevision) return;
        await api.encryption.createKey(identity.id, generated);
        if (revision !== sessionRevision) return;
        update((state) => ({
          ...state,
          identities: state.identities.map((entry) =>
            entry.id === identity.id ? { ...entry, hasEncryptionKey: true } : entry
          ),
          currentIdentity: state.currentIdentity?.id === identity.id
            ? { ...state.currentIdentity, hasEncryptionKey: true }
            : state.currentIdentity,
        }));
      } catch (error) {
        console.warn("[Auth] Failed to backfill encryption key for identity", identity.id, error);
      }
    }
  }

  async function hydrateAuthenticatedSession(identities: Identity[], isReadOnly: boolean, revision: number) {
    const masterKey = isReadOnly ? null : await resolveSessionMasterKey(identities);
    if (revision !== sessionRevision) return;
    const previous = get({ subscribe });
    if (previous.isAuthenticated && !identities.some((identity) => previous.identities.some((entry) => entry.id === identity.id))) {
      websocket.disconnect();
    }
    selectMasterKeyAccount(isReadOnly ? [] : identities.map((identity) => identity.id));
    update((state) => ({
      ...state,
      isAuthenticated: true,
      isLoading: false,
      isReadOnly,
      identities,
      currentIdentity: identities.find((identity) => identity.id === state.currentIdentity?.id)
        || identities.find((identity) => identity.isPrimary) || identities[0] || null,
      masterKey,
      hasMasterKey: masterKey !== null,
    }));
    if (!isReadOnly) void ensureIdentityEncryptionKeys(identities, masterKey, revision);
    websocket.connectAsUser();
  }

  return {
    subscribe,

    async init(options: InitOptions = {}) {
      if (initPromise) return initPromise;
      const revision = sessionRevision;
      const pending = (async () => {
        try {
          const session = await api.oauth.getSessionBootstrap(options.timeoutMs);
          await hydrateAuthenticatedSession(session.identities, !!session.readOnly, revision);
        } catch (error) {
          if (revision !== sessionRevision) return;
          if (error instanceof ApiError && error.status === 401) {
            websocket.disconnect();
            selectMasterKeyAccount([]);
            set({ ...initialState, isLoading: false });
          } else {
            update((state) => ({ ...state, isLoading: false }));
            throw error;
          }
        }
      })();
      initPromise = pending;
      try {
        await pending;
      } finally {
        if (initPromise === pending) initPromise = null;
      }
    },

    /**
     * Login successfully
     */
    async login(
      { identities, device }: LoginSession,
      masterKey?: CryptoKey,
      options: LoginOptions = {}
    ) {
      const revision = ++sessionRevision;
      const activeMasterKey = options.isReadOnly ? null : await resolveSessionMasterKey(identities, masterKey);
      if (revision !== sessionRevision) return;
      selectMasterKeyAccount(options.isReadOnly ? [] : identities.map((identity) => identity.id));

      update((s) => ({
        ...s,
        isAuthenticated: true,
        isLoading: false,
        isReadOnly: !!options.isReadOnly,
        identities,
        currentIdentity: (options.preserveCurrentIdentity
          ? identities.find((identity) => identity.id === s.currentIdentity?.id)
          : null) || identities.find((identity) => identity.isPrimary) || identities[0] || null,
        device,
        masterKey: activeMasterKey,
        hasMasterKey: activeMasterKey !== null,
      }));

      if (!options.isReadOnly) void ensureIdentityEncryptionKeys(identities, activeMasterKey, revision);

      if (options.offerPasskeySetup && !options.isReadOnly) {
        queuePasskeySetupPrompt(device);
      }
      
      websocket.disconnect();
      websocket.connectAsUser();
    },
    
    /**
     * Set master key (after receiving from another device)
     */
    async setMasterKey(masterKey: CryptoKey, provenIdentityIds: string[]) {
      const state = get({ subscribe });
      const revision = sessionRevision;
      if (!state.isAuthenticated || state.isReadOnly) throw new Error("Sign in before unlocking your encryption key.");
      if (!state.identities.some((identity) => provenIdentityIds.includes(identity.id))) {
        throw new Error("Your account changed. Reload Ave and unlock again.");
      }
      await storeMasterKey(masterKey, state.identities.map((identity) => identity.id));
      if (revision !== sessionRevision || !get({ subscribe }).identities.some((identity) => provenIdentityIds.includes(identity.id))) {
        throw new Error("Your account changed. Reload Ave and unlock again.");
      }
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
      await api.login.logout();
      sessionRevision++;
      clearD1Bookmark();
      websocket.disconnect();
      set({ ...initialState, isLoading: false });
      await clearMasterKey();
    },

    /**
     * Update identities
     */
    setIdentities(identities: Identity[]) {
      const current = get({ subscribe });
      const identityIds = identities.map((identity) => identity.id);
      selectMasterKeyAccount(current.isReadOnly ? [] : identityIds);
      if (current.masterKey && identityIds.length) void storeMasterKey(current.masterKey, identityIds);
      update((s) => ({
        ...s,
        identities,
        currentIdentity: s.currentIdentity 
          ? identities.find((i) => i.id === s.currentIdentity!.id) || identities.find((i) => i.isPrimary) || identities[0] || null
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
      const state = get({ subscribe });
      this.setIdentities([...state.identities, identity]);
    },
    
    /**
     * Remove an identity
     */
    removeIdentity(identityId: string) {
      const state = get({ subscribe });
      this.setIdentities(state.identities.filter((identity) => identity.id !== identityId));
    },
  };
}

export const auth = createAuthStore();

// Derived stores for convenience
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
export const currentIdentity = derived(auth, ($auth) => $auth.currentIdentity);
export const identities = derived(auth, ($auth) => $auth.identities);
export const isReadOnly = derived(auth, ($auth) => $auth.isReadOnly);
