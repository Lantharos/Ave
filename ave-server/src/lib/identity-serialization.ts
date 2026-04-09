import { type Identity } from "../db";

export type SerializedIdentity = {
  id: string;
  displayName: string;
  handle: string;
  email?: string;
  pendingEmail?: string | null;
  birthday?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isPrimary: boolean;
  createdAt: Date;
};

export function serializeIdentityForOwner(identity: Identity): SerializedIdentity {
  return {
    id: identity.id,
    displayName: identity.displayName,
    handle: identity.handle,
    email: identity.email || undefined,
    pendingEmail: identity.pendingEmail,
    birthday: identity.birthday,
    avatarUrl: identity.avatarUrl,
    bannerUrl: identity.bannerUrl,
    isPrimary: identity.isPrimary,
    createdAt: identity.createdAt,
  };
}

export function serializeIdentityForApp(identity: Identity) {
  return {
    id: identity.id,
    displayName: identity.displayName,
    handle: identity.handle,
    email: identity.email || undefined,
    avatarUrl: identity.avatarUrl,
    isPrimary: identity.isPrimary,
  };
}

export function hasVerifiedEmail(identity: Pick<Identity, "email">): boolean {
  return Boolean(identity.email);
}
