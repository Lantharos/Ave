import { ApiError, createAveApiClient } from "$lib/infrastructure/http/ave-api-client";
import { resolveApiBase } from "$lib/infrastructure/http/origins";
import { enterpriseSsoRedirect } from "./enterprise-sso";
import type { WorkspaceMember, WorkspaceRole, WorkspaceState, WorkspaceSummary } from "./portal";

const client = createAveApiClient({ baseUrl: resolveApiBase() });
async function request<T>(...args: Parameters<typeof client.request>): Promise<T> {
  try {
    return await client.request<T>(...args);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && typeof window !== "undefined") {
      const target = enterpriseSsoRedirect(error.data, resolveApiBase(), window.location.href);
      if (target) window.location.assign(target);
    }
    throw error;
  }
}

export interface DevApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  developmentMode: boolean;
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
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

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PortalBootstrap {
  organizations: WorkspaceSummary[];
  currentOrganizationId: string | null;
  organization: WorkspaceState | null;
  apps: DevApp[];
}

export interface CreateAppPayload {
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  developmentMode?: boolean;
  supportsE2ee?: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  organizationId?: string;
}

export interface UpdateAppPayload extends Omit<Partial<CreateAppPayload>, "description" | "websiteUrl" | "iconUrl"> {
  description?: string | null;
  websiteUrl?: string | null;
  iconUrl?: string | null;
}

function mapWorkspaceState(payload: WorkspaceState): WorkspaceState {
  return {
    ...payload,
    logoUrl: payload.logoUrl || null,
  };
}

async function signWorkspaceAction(identityId: string, action: string, details: Record<string, unknown>) {
  const { signBusinessAction } = await import("$lib/surfaces/business/lib/business-actions");
  return signBusinessAction(identityId, action, details);
}

export async function fetchPortalBootstrap(organizationId?: string): Promise<PortalBootstrap> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const data = await request<PortalBootstrap>(`/api/organizations/bootstrap${query}`);
  return {
    ...data,
    organization: data.organization ? mapWorkspaceState(data.organization) : null,
  };
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
  actingIdentityId: string,
  payload: { name?: string; logoUrl?: string | null },
): Promise<WorkspaceState> {
  const signedAction = await signWorkspaceAction(actingIdentityId, "workspace.updated", { organizationId, ...payload });
  const data = await request<{ organization: WorkspaceState }>(`/api/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...payload, signedAction }),
  });

  return mapWorkspaceState({
    ...data.organization,
    members: [],
    appCount: 0,
  });
}

export async function inviteOrganizationMember(
  organizationId: string,
  actingIdentityId: string,
  payload: { email: string; role: WorkspaceRole },
): Promise<{ member: WorkspaceMember }> {
  const email = payload.email.trim().toLowerCase();
  const signedAction = await signWorkspaceAction(actingIdentityId, "workspace.member.added", { organizationId, email, role: payload.role });
  return request(`/api/organizations/${organizationId}/invites`, {
    method: "POST",
    body: JSON.stringify({ ...payload, email, signedAction }),
  });
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  actingIdentityId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<{ member: { id: string; role: WorkspaceRole; status: string } }> {
  const signedAction = await signWorkspaceAction(actingIdentityId, "workspace.member.updated", { organizationId, memberId, role });
  return request(`/api/organizations/${organizationId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role, signedAction }),
  });
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
  options: { limit?: number; cursor?: string } = {},
): Promise<CursorPaginatedResult<AppEvent>> {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.cursor) query.set("cursor", options.cursor);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<CursorPaginatedResult<AppEvent>>(`/api/apps/${appId}/activity${suffix}`);
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
  payload: UpdateAppPayload,
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

  return request<{ logoUrl: string }>("/api/upload/workspace-logo", { method: "POST", body: formData });
}

export { ApiError };
