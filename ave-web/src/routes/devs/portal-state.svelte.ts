import type { AppEvent, AppIdentityRecord, AppInsightSnapshot, AppOverviewBundle, DevApp } from "$lib/surfaces/devs/lib/api";
import type { WorkspaceState, WorkspaceSummary } from "$lib/surfaces/devs/lib/portal";
export type WorkspaceSection = "applications" | "organization";
export type AppSection = "overview" | "identities" | "activity" | "configure";

export function createPortalState() {
    let workspaceSection: WorkspaceSection = $state("applications");
    let appSection: AppSection = $state("overview");
    let organizations: WorkspaceSummary[] = $state([]);
    let currentOrganizationId: string | null = $state(null);
    let workspace: WorkspaceState | null = $state(null);
    let apps: DevApp[] = $state([]);
    let selectedAppId: string | null = $state(null);
    let appInsights: AppInsightSnapshot | null = $state(null);
    let appIdentities: AppIdentityRecord[] = $state([]);
    let appEvents: AppEvent[] = $state([]);
    let appIdentitiesTotal = $state(0);
    let appEventsTotal = $state(0);
    let appEventsCursor: string | null = $state(null);
    let appEventsHasMore = $state(false);
    let appIdentitiesLoadingMore = $state(false);
    let appEventsLoadingMore = $state(false);
    let appBundles: Record<string, AppOverviewBundle> = $state({});
    let deleteTarget: DevApp | null = $state(null);
    let createModalOpen = $state(false);
    let createOrganizationModalOpen = $state(false);
    let newOrganizationName = $state("");
    let creatingOrganization = $state(false);
    let loading = $state(true);
    let appLoading = $state(false);
    let error = $state("");
    let authenticated = $state(false);
    let newSecret: string | null = $state(null);
    let creating = $state(false);
    let deleting = $state(false);
    let saveState: "idle" | "saving" | "saved" = $state("idle");
    let rotatingAppId: string | null = $state(null);
    let rotatedAppId: string | null = $state(null);
    let saveStateTimer: ReturnType<typeof setTimeout> | null = null;
    let rotateStateTimer: ReturnType<typeof setTimeout> | null = null;
    const selectedApp = $derived.by(() => {
        const app = apps.find((entry) => entry.id === selectedAppId);
        if (!app) return null;

        return {
            ...app,
            redirectUrisText: app.redirectUris.join("\n"),
        };
    });
    const activeWorkspaceMembers = $derived.by(() =>
        workspace ? workspace.members.filter((member) => member.status === "active").length : 0,
    );
    const workspaceNav = $derived([
        { id: "applications", label: "Applications", badge: apps.length },
        { id: "organization", label: "Organization", badge: activeWorkspaceMembers },
    ]);
    const appNav = $derived([
        { id: "overview", label: "Overview" },
        { id: "identities", label: "Identities", badge: appIdentitiesTotal || appIdentities.length },
        { id: "activity", label: "Activity", badge: appEventsTotal || appEvents.length },
        { id: "configure", label: "Configure" },
    ]);
    return {
        get workspaceSection() { return workspaceSection; },
        set workspaceSection(value: typeof workspaceSection) { workspaceSection = value; },
        get appSection() { return appSection; },
        set appSection(value: typeof appSection) { appSection = value; },
        get organizations() { return organizations; },
        set organizations(value: typeof organizations) { organizations = value; },
        get currentOrganizationId() { return currentOrganizationId; },
        set currentOrganizationId(value: typeof currentOrganizationId) { currentOrganizationId = value; },
        get workspace() { return workspace; },
        set workspace(value: typeof workspace) { workspace = value; },
        get apps() { return apps; },
        set apps(value: typeof apps) { apps = value; },
        get selectedAppId() { return selectedAppId; },
        set selectedAppId(value: typeof selectedAppId) { selectedAppId = value; },
        get appInsights() { return appInsights; },
        set appInsights(value: typeof appInsights) { appInsights = value; },
        get appIdentities() { return appIdentities; },
        set appIdentities(value: typeof appIdentities) { appIdentities = value; },
        get appEvents() { return appEvents; },
        set appEvents(value: typeof appEvents) { appEvents = value; },
        get appIdentitiesTotal() { return appIdentitiesTotal; },
        set appIdentitiesTotal(value: typeof appIdentitiesTotal) { appIdentitiesTotal = value; },
        get appEventsTotal() { return appEventsTotal; },
        set appEventsTotal(value: typeof appEventsTotal) { appEventsTotal = value; },
        get appEventsCursor() { return appEventsCursor; },
        set appEventsCursor(value: typeof appEventsCursor) { appEventsCursor = value; },
        get appEventsHasMore() { return appEventsHasMore; },
        set appEventsHasMore(value: typeof appEventsHasMore) { appEventsHasMore = value; },
        get appIdentitiesLoadingMore() { return appIdentitiesLoadingMore; },
        set appIdentitiesLoadingMore(value: typeof appIdentitiesLoadingMore) { appIdentitiesLoadingMore = value; },
        get appEventsLoadingMore() { return appEventsLoadingMore; },
        set appEventsLoadingMore(value: typeof appEventsLoadingMore) { appEventsLoadingMore = value; },
        get appBundles() { return appBundles; },
        set appBundles(value: typeof appBundles) { appBundles = value; },
        get deleteTarget() { return deleteTarget; },
        set deleteTarget(value: typeof deleteTarget) { deleteTarget = value; },
        get createModalOpen() { return createModalOpen; },
        set createModalOpen(value: typeof createModalOpen) { createModalOpen = value; },
        get createOrganizationModalOpen() { return createOrganizationModalOpen; },
        set createOrganizationModalOpen(value: typeof createOrganizationModalOpen) { createOrganizationModalOpen = value; },
        get newOrganizationName() { return newOrganizationName; },
        set newOrganizationName(value: typeof newOrganizationName) { newOrganizationName = value; },
        get creatingOrganization() { return creatingOrganization; },
        set creatingOrganization(value: typeof creatingOrganization) { creatingOrganization = value; },
        get loading() { return loading; },
        set loading(value: typeof loading) { loading = value; },
        get appLoading() { return appLoading; },
        set appLoading(value: typeof appLoading) { appLoading = value; },
        get error() { return error; },
        set error(value: typeof error) { error = value; },
        get authenticated() { return authenticated; },
        set authenticated(value: typeof authenticated) { authenticated = value; },
        get newSecret() { return newSecret; },
        set newSecret(value: typeof newSecret) { newSecret = value; },
        get creating() { return creating; },
        set creating(value: typeof creating) { creating = value; },
        get deleting() { return deleting; },
        set deleting(value: typeof deleting) { deleting = value; },
        get saveState() { return saveState; },
        set saveState(value: typeof saveState) { saveState = value; },
        get rotatingAppId() { return rotatingAppId; },
        set rotatingAppId(value: typeof rotatingAppId) { rotatingAppId = value; },
        get rotatedAppId() { return rotatedAppId; },
        set rotatedAppId(value: typeof rotatedAppId) { rotatedAppId = value; },
        get saveStateTimer() { return saveStateTimer; },
        set saveStateTimer(value: typeof saveStateTimer) { saveStateTimer = value; },
        get rotateStateTimer() { return rotateStateTimer; },
        set rotateStateTimer(value: typeof rotateStateTimer) { rotateStateTimer = value; },
        get selectedApp() { return selectedApp; },
        get activeWorkspaceMembers() { return activeWorkspaceMembers; },
        get workspaceNav() { return workspaceNav; },
        get appNav() { return appNav; },
    };
}
export type PortalState = ReturnType<typeof createPortalState>;
