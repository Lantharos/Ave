import type { WorkspaceMember, WorkspaceRole, WorkspaceState, WorkspaceSummary } from "./portal";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.aveid.net";

export interface DevApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  allowUserIdScope: boolean;
  createdAt: string;
  organizationId?: string | null;
  identityCount?: number;
  resources?: AppResource[];
}

export interface AppResource {
  id: string;
  resourceKey: string;
  displayName: string;
  description?: string;
  scopes: string[];
  audience: string;
  status: "active" | "disabled";
}

export interface AppInsightSnapshot {
  totalIdentities: number;
  totalAuthorizations: number;
  weeklyAuthorizations: number;
  activeRefreshTokens: number;
  instantSignInRate: number;
  methodCounts: {
    passkey: number;
    deviceApproval: number;
    trustCode: number;
    unknown: number;
  };
  redirectSecurityRate: number;
  resources: number;
  activeDelegations: number;
  revocations: number;
  totalActivityEvents: number;
}

export interface AppIdentityRecord {
  id: string;
  displayName: string;
  handle: string;
  email?: string | null;
  avatarUrl?: string | null;
  isPrimary: boolean;
  firstSeen: string;
  lastActive: string;
  signInCount: number;
  authorizationCount: number;
  refreshCount: number;
  lastMethod?: string | null;
}

export interface AppEvent {
  id: string;
  action: string;
  details?: Record<string, unknown> | null;
  severity: "info" | "warning" | "danger";
  createdAt: string;
  source: "activity" | "delegation";
}

export interface AppOverviewBundle {
  insights: AppInsightSnapshot;
  identities: AppIdentityRecord[];
  events: AppEvent[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CreateAppPayload {
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  allowUserIdScope?: boolean;
  organizationId?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || "Request failed");
  }

  return data as T;
}

function mapWorkspaceState(payload: {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug: string;
  plan: string;
  verifiedDomains: string[];
  appLimit: number;
  role: WorkspaceRole;
  members: WorkspaceMember[];
  appCount: number;
}): WorkspaceState {
  return {
    id: payload.id,
    name: payload.name,
    logoUrl: payload.logoUrl || null,
    slug: payload.slug,
    plan: payload.plan,
    verifiedDomains: payload.verifiedDomains || [],
    appLimit: payload.appLimit,
    role: payload.role,
    members: payload.members,
    appCount: payload.appCount,
  };
}

export async function fetchOrganizations(organizationId?: string): Promise<{
  organizations: WorkspaceSummary[];
  currentOrganizationId: string | null;
}> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  return request(`/api/organizations${query}`);
}

export async function createOrganization(name: string): Promise<{ organization: WorkspaceSummary }> {
  return request("/api/organizations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function fetchOrganization(organizationId: string): Promise<WorkspaceState> {
  const data = await request<{ organization: WorkspaceState }>(`/api/organizations/${organizationId}`);
  return mapWorkspaceState(data.organization);
}

export async function updateOrganization(
  organizationId: string,
  payload: { name?: string; logoUrl?: string | null; verifiedDomains?: string[] },
): Promise<WorkspaceState> {
  const data = await request<{ organization: WorkspaceState }>(`/api/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return mapWorkspaceState({
    ...data.organization,
    members: [],
    appCount: 0,
  });
}

export async function inviteOrganizationMember(
  organizationId: string,
  payload: { email: string; role: WorkspaceRole },
): Promise<{ member: WorkspaceMember }> {
  return request(`/api/organizations/${organizationId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<{ member: { id: string; role: WorkspaceRole; status: string } }> {
  return request(`/api/organizations/${organizationId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function fetchApps(organizationId?: string): Promise<DevApp[]> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const data = await request<{ apps: DevApp[] }>(`/api/apps${query}`);
  return data.apps;
}

export async function fetchAppOverview(appId: string): Promise<AppOverviewBundle> {
  return request<AppOverviewBundle>(`/api/apps/${appId}/overview`);
}

export async function fetchAppIdentities(
  appId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedResult<AppIdentityRecord>> {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.offset !== undefined) query.set("offset", String(options.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedResult<AppIdentityRecord>>(`/api/apps/${appId}/identities${suffix}`);
}

export async function fetchAppActivity(
  appId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedResult<AppEvent>> {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.offset !== undefined) query.set("offset", String(options.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<PaginatedResult<AppEvent>>(`/api/apps/${appId}/activity${suffix}`);
}

export async function createApp(
  payload: CreateAppPayload,
): Promise<{ app: DevApp; clientSecret: string }> {
  return request("/api/apps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateApp(
  appId: string,
  payload: Partial<CreateAppPayload>,
): Promise<{ app: DevApp }> {
  return request(`/api/apps/${appId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteApp(appId: string): Promise<{ success: boolean }> {
  return request(`/api/apps/${appId}`, {
    method: "DELETE",
  });
}

export async function rotateSecret(
  appId: string,
): Promise<{ clientSecret: string }> {
  return request(`/api/apps/${appId}/rotate-secret`, {
    method: "POST",
  });
}

export async function createResource(
  appId: string,
  payload: Omit<AppResource, "id">,
): Promise<{ resource: AppResource }> {
  return request(`/api/apps/${appId}/resources`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteResource(
  appId: string,
  resourceId: string,
): Promise<{ success: boolean }> {
  return request(`/api/apps/${appId}/resources/${resourceId}`, {
    method: "DELETE",
  });
}

export async function uploadWorkspaceLogo(organizationId: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append("organizationId", organizationId);
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/upload/workspace-logo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || "Upload failed");
  }

  return data as { logoUrl: string };
}

export async function logoutSession(): Promise<void> {
  await request<{ success: boolean }>("/api/login/logout", {
    method: "POST",
  });
}

export { ApiError };
