export type WorkspaceRole = "owner" | "admin" | "viewer";

export interface WorkspaceMember {
  id: string;
  userId?: string | null;
  name: string;
  email?: string | null;
  role: WorkspaceRole;
  status: "active" | "invited";
  joinedAt: string;
  avatarUrl?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug: string;
  plan: string;
  verifiedDomains: string[];
  appLimit: number;
  role: WorkspaceRole;
  appCount: number;
  memberCount: number;
}

export interface WorkspaceState {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug: string;
  plan: string;
  appLimit: number;
  verifiedDomains: string[];
  role: WorkspaceRole;
  members: WorkspaceMember[];
  appCount: number;
}

export function shortId(value: string, size = 8): string {
  if (!value) return "";
  return value.length <= size ? value : value.slice(0, size);
}

export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string | number | Date): string {
  const timestamp = new Date(value).getTime();
  const diff = timestamp - Date.now();
  const minutes = Math.round(diff / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");

  const months = Math.round(days / 30);
  return formatter.format(months, "month");
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "AV";
}

export function getActivityLabel(action: string): string {
  const labels: Record<string, string> = {
    oauth_authorized: "Authorization approved",
    oauth_revoked: "Authorization revoked",
    authorization_added: "Authorization added",
    authorization_revoked: "Authorization revoked",
    login: "Sign-in completed",
    login_approved: "Sign-in approved",
    login_denied: "Sign-in denied",
    identity_created: "Identity created",
    identity_updated: "Identity updated",
    identity_deleted: "Identity deleted",
    passkey_added: "Passkey added",
    passkey_removed: "Passkey removed",
    signing_key_created: "Signing key created",
    signing_key_rotated: "Signing key rotated",
    grant_created: "Delegation granted",
    grant_revoked: "Delegation revoked",
    token_exchanged: "Token exchanged",
    grant_denied: "Delegation denied",
  };

  return labels[action] || action.replace(/_/g, " ");
}

export function getActivityTone(severity: "info" | "warning" | "danger") {
  if (severity === "danger") return "text-[#f37f7f] bg-[#f37f7f]/10";
  if (severity === "warning") return "text-[#f0c674] bg-[#f0c674]/10";
  return "text-[#B9BBBE] bg-[#B9BBBE]/10";
}
