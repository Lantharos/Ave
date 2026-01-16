<script lang="ts">
  import { onMount } from "svelte";
  import Button from "./components/Button.svelte";
  import Card from "./components/Card.svelte";
  import Input from "./components/Input.svelte";
  import Textarea from "./components/Textarea.svelte";
  import Toggle from "./components/Toggle.svelte";
  import { createApp, fetchApps, rotateSecret, updateApp, deleteApp, type DevApp } from "./lib/api";
  import { handleCallback, refreshSession, startLogin, logout } from "./lib/auth";
  import { loadSession } from "./lib/storage";
  import { defaultScopes } from "./lib/types";

  type View = "overview" | "apps" | "create" | "activity" | "settings" | "app";

  const clientId = import.meta.env.VITE_DEV_PORTAL_CLIENT_ID as string | undefined;

  let activeView: View = "overview";
  let apps: DevApp[] = [];
  let selectedApp: (DevApp & { redirectUrisText?: string }) | null = null;
  let loading = true;
  let error = "";
  let session = loadSession();
  let newSecret: string | null = null;
  let creating = false;

  let form = {
    name: "",
    description: "",
    websiteUrl: "",
    iconUrl: "",
    redirectUris: "",
    supportsE2ee: false,
    allowUserIdScope: true,
    accessTokenTtlSeconds: 3600,
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    allowedScopes: [...defaultScopes],
  };

  const stats = [
    { label: "Apps", value: () => apps.length },
    { label: "Redirects", value: () => apps.reduce((sum, app) => sum + app.redirectUris.length, 0) },
    { label: "E2EE", value: () => apps.filter((app) => app.supportsE2ee).length },
  ];

  const resources = [
    {
      title: "OIDC Discovery",
      detail: "https://api.aveid.net/.well-known/openid-configuration",
    },
    {
      title: "JWKS",
      detail: "https://api.aveid.net/.well-known/jwks.json",
    },
    {
      title: "Token Endpoint",
      detail: "https://api.aveid.net/api/oauth/token",
    },
    {
      title: "Userinfo",
      detail: "https://api.aveid.net/api/oauth/userinfo",
    },
  ];

  const quickStarts = [
    {
      title: "Web apps (PKCE)",
      description: "Use the Ave SDK for SPA-friendly OAuth + OIDC.",
      href: "https://aveid.net/docs#pkce",
    },
    {
      title: "Server apps",
      description: "Exchange tokens server-side with client secret.",
      href: "https://aveid.net/docs#endpoints",
    },
    {
      title: "Embed sign-in",
      description: "Drop in the Ave iframe widget with postMessage events.",
      href: "https://aveid.net/docs#sdks",
    },
  ];

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") && clientId) {
      try {
        await handleCallback({ clientId });
        window.history.replaceState({}, document.title, "/");
        session = loadSession();
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to finish sign-in";
      }
    }

    if (session?.accessTokenJwt) {
      await loadApps();
    } else {
      loading = false;
    }
  });

  async function loadApps() {
    if (!session?.accessTokenJwt) return;
    loading = true;
    try {
      apps = await fetchApps(session.accessTokenJwt);
    } catch (err) {
      if (session?.refreshToken) {
        try {
          await refreshSession();
          session = loadSession();
          if (session?.accessTokenJwt) {
            apps = await fetchApps(session.accessTokenJwt);
          }
        } catch (refreshError) {
          error = refreshError instanceof Error ? refreshError.message : "Session expired";
        }
      } else {
        error = err instanceof Error ? err.message : "Failed to load apps";
      }
    } finally {
      loading = false;
    }
  }

  async function handleCreate() {
    if (!session?.accessTokenJwt) return;
    creating = true;
    error = "";
    newSecret = null;

    try {
      const redirectUris = form.redirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);

      const result = await createApp(session.accessTokenJwt, {
        name: form.name,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        iconUrl: form.iconUrl || undefined,
        redirectUris,
        supportsE2ee: form.supportsE2ee,
        allowUserIdScope: form.allowUserIdScope,
        accessTokenTtlSeconds: form.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: form.refreshTokenTtlSeconds,
        allowedScopes: form.allowedScopes,
      });

      apps = [result.app, ...apps];
      newSecret = result.clientSecret;
      activeView = "apps";
      form = {
        name: "",
        description: "",
        websiteUrl: "",
        iconUrl: "",
        redirectUris: "",
        supportsE2ee: false,
        allowUserIdScope: true,
        accessTokenTtlSeconds: 3600,
        refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
        allowedScopes: [...defaultScopes],
      };
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create app";
    } finally {
      creating = false;
    }
  }

  async   function handleRotateSecret(appId: string) {
    if (!session?.accessTokenJwt) return;
    error = "";
    try {
      const result = await rotateSecret(session.accessTokenJwt, appId);
      newSecret = result.clientSecret;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to rotate secret";
    }
  }

  function openApp(app: DevApp) {
    selectedApp = { ...app, redirectUrisText: app.redirectUris.join("\n") } as DevApp & { redirectUrisText: string };
    activeView = "app";
  }

  async function saveApp() {
    if (!session?.accessTokenJwt || !selectedApp) return;
    error = "";
    const app = selectedApp as DevApp & { redirectUrisText?: string };
    try {
      const payload = {
        name: app.name,
        description: app.description || undefined,
        websiteUrl: app.websiteUrl || undefined,
        iconUrl: app.iconUrl || undefined,
        redirectUris: (app.redirectUrisText || "")
          .split("\n")
          .map((uri) => uri.trim())
          .filter(Boolean),
        supportsE2ee: app.supportsE2ee,
        allowedScopes: app.allowedScopes,
        accessTokenTtlSeconds: app.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: app.refreshTokenTtlSeconds,
        allowUserIdScope: app.allowUserIdScope,
      };

      const result = await updateApp(session.accessTokenJwt, selectedApp.id, payload);
      apps = apps.map((app) => (app.id === result.app.id ? result.app : app));
      selectedApp = { ...result.app, redirectUrisText: result.app.redirectUris.join("\n") } as DevApp & { redirectUrisText: string };
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update app";
    }
  }

  async function handleDeleteApp(appId: string) {
    if (!session?.accessTokenJwt) return;
    error = "";
    try {
      await deleteApp(session.accessTokenJwt, appId);
      apps = apps.filter((app) => app.id !== appId);
      activeView = "apps";
      selectedApp = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete app";
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to copy";
    }
  }


  function startDevLogin() {
    if (!clientId) {
      error = "VITE_DEV_PORTAL_CLIENT_ID is not configured";
      return;
    }
    startLogin({ clientId });
  }

  function handleLogout() {
    logout();
    session = null;
    apps = [];
  }
</script>

<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <img src="/icon.png" alt="Ave" />
    </div>

    {#if session?.accessTokenJwt}
      <nav class="nav">
        <button class:active={activeView === "overview"} on:click={() => (activeView = "overview")}>Overview</button>
        <button class:active={activeView === "apps"} on:click={() => (activeView = "apps")}>Apps</button>
        <button class:active={activeView === "create"} on:click={() => (activeView = "create")}>Create app</button>
        <button class:active={activeView === "activity"} on:click={() => (activeView = "activity")}>Activity</button>
        <button class:active={activeView === "settings"} on:click={() => (activeView = "settings")}>Settings</button>
      </nav>
      <div class="sidebar__footer">
        <Button variant="ghost" on:click={handleLogout}>Sign out</Button>
      </div>
    {:else}
      <div class="sidebar__footer sidebar__footer--center">
        <Button variant="primary" on:click={startDevLogin}>Sign in</Button>
      </div>
    {/if}
  </aside>

  <main class="content">
    {#if !session?.accessTokenJwt}
      <div class="signin">
        <div class="signin__content">
          <h1>Sign in to manage your Ave apps.</h1>
          <p>Access credentials, redirect URIs, and OIDC scopes for every project.</p>
          {#if error}
            <div class="alert">{error}</div>
          {/if}
          <Button variant="primary" on:click={startDevLogin}>Sign in with Ave</Button>
        </div>
      </div>
    {:else}
      <header class="hero">
        <div>
          <p class="eyebrow">Ave Developer Portal</p>
          <h1>Build with Ave identity.</h1>
          <p>Control OAuth + OIDC apps, credentials, and security posture.</p>
        </div>
        <div class="hero__actions">
          <Button variant="ghost" on:click={() => window.open("https://aveid.net/docs", "_blank")}>View docs</Button>
          <Button variant="outline" on:click={() => window.location.href = "mailto:hello@lantharos.com"}>Contact support</Button>
        </div>
      </header>

      {#if error}
        <div class="alert">{error}</div>
      {/if}

      {#if newSecret}
        <div class="secret">
          <div>
            <h3>New client secret</h3>
            <p>Copy this secret now. You won't see it again.</p>
          </div>
          <code>{newSecret}</code>
        </div>
      {/if}

      {#if activeView === "overview"}
        <section class="section">
          <div class="stat-grid">
            {#each stats as stat}
              <Card>
                <p>{stat.label}</p>
                <h2>{stat.value()}</h2>
              </Card>
            {/each}
          </div>
        </section>

        <section class="section">
          <div class="section__header">
            <div>
              <h2>Quick start</h2>
              <p>Pick a path and ship sign-in fast.</p>
            </div>
          </div>
          <div class="grid">
              {#each quickStarts as item}
              <Card>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <Button variant="outline" on:click={() => window.open(item.href, "_blank")}>View guide</Button>
              </Card>
            {/each}

          </div>
        </section>

        <section class="section">
          <Card tone="soft">
            <div class="section__header">
              <div>
                <h2>Live endpoints</h2>
                <p>Reference the current Ave OIDC endpoints and key sets.</p>
              </div>
              <Button variant="ghost" on:click={() => window.open("https://aveid.net/docs#endpoints", "_blank")}>Open API reference</Button>
            </div>
            <div class="stack">
              {#each resources as item}
                <div class="row">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.detail}</p>
                  </div>
                  <Button variant="outline" on:click={() => handleCopy(item.detail)}>Copy URL</Button>
                </div>
              {/each}
            </div>
          </Card>
        </section>
      {:else if activeView === "apps"}
        <section class="section">
          <div class="section__header">
            <div>
              <h2>Your apps</h2>
              <p>Manage apps tied to your Ave user account.</p>
            </div>
            <Button variant="primary" on:click={() => (activeView = "create")} disabled={!session?.accessTokenJwt}>Create new app</Button>
          </div>

          {#if loading}
            <Card>Loading apps...</Card>
          {:else if apps.length === 0}
            <Card>No apps yet. Create your first app.</Card>
          {:else}
            <div class="stack">
              {#each apps as app}
                <Card>
                  <div class="app-row">
                    <div>
                      <h3>{app.name}</h3>
                      <p>Client ID: {app.clientId}</p>
                      <p>Redirects: {app.redirectUris.length}</p>
                      <p>Scopes: {app.allowedScopes.join(", ")}</p>
                    </div>
                    <div class="app-actions">
                      <Button variant="ghost" on:click={() => openApp(app)}>Manage</Button>
                      <Button variant="outline" on:click={() => handleRotateSecret(app.id)}>Rotate secret</Button>
                    </div>
                  </div>
                </Card>
              {/each}
            </div>
          {/if}
        </section>
      {:else if activeView === "create"}
        <section class="section">
          <Card>
            <div class="section__header">
              <div>
                <h2>Create app</h2>
                <p>Configure redirect URIs, scopes, and token lifetimes.</p>
              </div>
              <Button variant="ghost" on:click={() => (activeView = "apps")}>Cancel</Button>
            </div>
            <div class="form__grid">
              <label class="full">
                App name
                <Input bind:value={form.name} placeholder="My App" />
              </label>
              <label class="full">
                Description
                <Input bind:value={form.description} placeholder="Short description" />
              </label>
              <label class="full">
                Website URL
                <Input bind:value={form.websiteUrl} placeholder="https://" />
              </label>
              <label class="full">
                Icon URL
                <Input bind:value={form.iconUrl} placeholder="https://" />
              </label>
              <label class="full">
                Redirect URIs (one per line)
                <Textarea bind:value={form.redirectUris} rows={4} />
              </label>
              <label class="full">
                Access token TTL (seconds)
                <Input type="number" bind:value={form.accessTokenTtlSeconds} />
              </label>
              <label class="full">
                Refresh token TTL (seconds)
                <Input type="number" bind:value={form.refreshTokenTtlSeconds} />
              </label>
              <div class="toggle-row">
                <Toggle bind:checked={form.supportsE2ee} label="Enable E2EE" />
                <Toggle bind:checked={form.allowUserIdScope} label="Allow user_id scope (discouraged)" />
              </div>
            </div>
            <div class="form__actions">
              <Button variant="primary" on:click={handleCreate} disabled={creating || !form.name || !form.redirectUris}>Create app</Button>
            </div>
          </Card>
        </section>
      {:else if activeView === "app" && selectedApp}
        {@const app = selectedApp}
        <section class="section">
          <Card>
            <div class="section__header">
              <div>
                <h2>{app.name}</h2>
                <p>Manage credentials, redirects, and scopes.</p>
              </div>
              <div class="action-row">
                <Button variant="ghost" on:click={() => handleCopy(app.clientId)}>Copy client ID</Button>
                <Button variant="outline" on:click={() => handleRotateSecret(app.id)}>Rotate secret</Button>
                <Button variant="outline" on:click={() => handleDeleteApp(app.id)}>Delete app</Button>
                <Button variant="ghost" on:click={() => (activeView = "apps")}>Back to apps</Button>
              </div>
            </div>
            <div class="form__grid">
              <label class="full">
                App name
                <Input bind:value={app.name} placeholder="App name" />
              </label>
              <label class="full">
                Description
                <Input bind:value={app.description} placeholder="Description" />
              </label>
              <label class="full">
                Website URL
                <Input bind:value={app.websiteUrl} placeholder="https://" />
              </label>
              <label class="full">
                Icon URL
                <Input bind:value={app.iconUrl} placeholder="https://" />
              </label>
              <label class="full">
                Redirect URIs (one per line)
                <Textarea bind:value={app.redirectUrisText} rows={4} />
              </label>
              <label class="full">
                Access token TTL (seconds)
                <Input type="number" bind:value={app.accessTokenTtlSeconds} />
              </label>
              <label class="full">
                Refresh token TTL (seconds)
                <Input type="number" bind:value={app.refreshTokenTtlSeconds} />
              </label>
              <div class="toggle-row">
                <Toggle bind:checked={app.supportsE2ee} label="Enable E2EE" />
                <Toggle bind:checked={app.allowUserIdScope} label="Allow user_id scope (discouraged)" />
              </div>
            </div>
            <div class="form__actions">
              <Button variant="primary" on:click={saveApp}>Save changes</Button>
            </div>
          </Card>
        </section>
      {:else if activeView === "activity"}
        <section class="section">
          <Card>
            <div class="section__header">
              <div>
                <h2>Activity</h2>
                <p>Recent app changes and credential updates.</p>
              </div>
              <Button variant="outline">Export logs</Button>
            </div>
            <p>No activity yet. Create an app to start logging events.</p>
          </Card>
        </section>
      {:else if activeView === "settings"}
        <section class="section">
          <div class="grid">
            <Card>
              <h3>Default scopes</h3>
              <p>{defaultScopes.join(", ")}</p>
              <Button variant="outline">Edit defaults</Button>
            </Card>
            <Card>
              <h3>Notifications</h3>
              <p>Control security alerts for credential changes.</p>
              <Button variant="outline">Configure</Button>
            </Card>
          </div>
        </section>
      {/if}
    {/if}
  </main>
</div>

<style>
  :global(body) {
    background-color: #090909;
  }

  .layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
    color: #ffffff;
  }

  .sidebar {
    height: 100vh;
    position: sticky;
    top: 0;
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    background: #0c0c0c;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
  }

  .brand img {
    width: 28px;
    height: 28px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nav button {
    background: transparent;
    border: 0;
    color: #b9bbbe;
    padding: 10px 12px;
    border-radius: 12px;
    text-align: left;
    font-size: 14px;
    cursor: pointer;
  }

  .nav button.active,
  .nav button:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }

  .sidebar__footer {
    margin-top: auto;
  }

  .sidebar__footer--center {
    margin-top: auto;
    display: flex;
    justify-content: center;
  }

  .content {
    padding: 36px clamp(24px, 4vw, 56px) 72px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    flex-wrap: wrap;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #777777;
    font-size: 12px;
  }

  .hero h1 {
    margin: 6px 0 8px;
    font-size: clamp(28px, 3vw, 42px);
  }

  .hero__actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  p {
    margin: 0;
    color: #9b9b9b;
    font-size: 15px;
    line-height: 1.6;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }

  h2 {
    margin: 0 0 6px;
    font-size: 22px;
  }

  h3 {
    margin: 0 0 8px;
  }

  .stat-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 0;
  }

  .app-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .app-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .alert {
    background: rgba(255, 71, 71, 0.12);
    padding: 14px 18px;
    border-radius: 16px;
  }

  .secret {
    background: rgba(255, 255, 255, 0.04);
    padding: 18px;
    border-radius: 18px;
    display: flex;
    gap: 18px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .secret code {
    background: rgba(255, 255, 255, 0.08);
    padding: 10px 14px;
    border-radius: 12px;
    color: #e0e0ff;
    font-size: 13px;
  }

  .form__grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #bbbbbb;
    font-size: 13px;
  }

  .toggle-row {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  .signin {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 80px);
  }

  .signin__content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 420px;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: relative;
      height: auto;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
    }

    .nav {
      flex-direction: row;
      gap: 6px;
      flex-wrap: wrap;
    }

    .signin {
      min-height: 60vh;
    }
  }
</style>
