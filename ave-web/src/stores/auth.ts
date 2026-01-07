/**
 * Auth store - manages authentication state
 */

import { writable, derived, get } from "svelte/store";
import { api, type Identity, type Device } from "../lib/api";
import { 
  loadMasterKey, 
  storeMasterKey, 
  clearMasterKey, 
  hasMasterKey
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

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  identities: [],
  currentIdentity: null,
  device: null,
  masterKey: null,
  hasMasterKey: false,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);
  
  return {
    subscribe,
    
    /**
     * Initialize auth state from storage
     */
    async init() {
      const token = localStorage.getItem("ave_session_token");
      
      if (!token) {
        update((s) => ({ ...s, isLoading: false }));
        return;
      }
      
      try {
        // Fetch identities to verify session is valid
        const { identities } = await api.identities.list();
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
        
        // Connect WebSocket for real-time notifications
        websocket.connectAsUser(token);
      } catch {
        // Session invalid, clear it
        localStorage.removeItem("ave_session_token");
        update((s) => ({ ...s, isLoading: false }));
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
