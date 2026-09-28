export interface WorkspaceMember {
  id: string;
  userId?: string | null;
  name: string;
  email?: string | null;
  joinedAt: string;
  avatarUrl?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug: string;
  appCount: number;
  memberCount: number;
}

export interface WorkspaceState {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug: string;
  members: WorkspaceMember[];
  appCount: number;
}

export function shortId(value: string, size = 8): string {
  if (!value) return "";
  return value.length <= size ? value : value.slice(0, size);
}

export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

export function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "AV";
}

export function getAuthMethodLabel(value?: string | null): string {
  if (value === "instant") return "instant";
  if (value === "passkey") return "passkey";
  if (value === "fallback" || value === "trust_code") return "fallback";
  if (value === "device_approval") return "device approval";
  return "unknown";
}
