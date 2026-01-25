<script lang="ts">
    import Text from "../../components/Text.svelte";
    import DocSec from "./components/DocSec.svelte";
    import CodeBlock from "./components/CodeBlock.svelte";
    import { route } from "@mateothegreat/svelte5-router";
    import { onMount } from "svelte";

    let activeSection = $state("overview");
    let mainContent: HTMLElement;

    const sections = [
        { id: "overview", title: "Overview" },
        { id: "getting-started", title: "Getting Started" },
        { id: "authorization-flow", title: "Authorization Flow" },
        { id: "pkce", title: "PKCE (Public Clients)" },
        { id: "sdks", title: "SDKs & Embed" },
        { id: "e2ee", title: "End-to-End Encryption" },
        { id: "signing", title: "Ave Signing" },
        { id: "endpoints", title: "API Endpoints" },
        { id: "user-data", title: "User Data" },
        { id: "security", title: "Security Best Practices" },
        { id: "common-mistakes", title: "Common Mistakes" },
        { id: "examples", title: "Code Examples" },

    ];

    function scrollToSection(id: string) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    }

    onMount(() => {
        // Scroll spy to update active section
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        activeSection = entry.target.id;
                    }
                });
            },
            {
                rootMargin: "-20% 0px -60% 0px",
                threshold: 0
            }
        );

        sections.forEach(({ id }) => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
    });

    let mobileSidebarOpen = $state(false);
</script>

<div class="bg-[#090909] w-full min-h-screen flex flex-col md:flex-row">
    <button 
        class="mobile-menu-btn fixed top-4 right-4 z-50 p-2 bg-[#171717] rounded-full"
        onclick={() => mobileSidebarOpen = !mobileSidebarOpen}
    >
        {#if mobileSidebarOpen}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
        {/if}
    </button>

    {#if mobileSidebarOpen}
        <div class="mobile-nav-overlay mobile-scroll-container py-12 px-6">
            <div class="flex flex-col gap-4 w-full max-w-sm">
                <a href="/" use:route class="text-white text-xl font-bold mb-4">← Back to Ave</a>
                <div class="flex items-center gap-2 text-xs text-[#555555] mb-2">
                    <a href="https://github.com/Lantharos/Ave" target="_blank" class="hover:text-[#999999] transition-colors">GitHub</a>
                    <span>·</span>
                    <a href="https://github.com/Lantharos/Ave/blob/main/LICENSE" target="_blank" class="hover:text-[#999999] transition-colors">AGPL-3.0</a>
                </div>
                <p class="text-[#555555] text-xs font-bold tracking-widest">OAUTH INTEGRATION</p>
                {#each sections as section}
                    <button 
                        class="text-left py-2 text-base {activeSection === section.id ? 'text-white font-medium' : 'text-[#777777]'}"
                        onclick={() => { scrollToSection(section.id); mobileSidebarOpen = false; }}
                    >
                        {section.title}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <nav class="hidden md:flex w-[300px] h-screen-fixed sticky top-0 border-r border-[#161616] bg-[#090909] flex-col desktop-nav">
        <div class="p-[30px] border-b border-[#161616]">
            <a href="/" use:route class="flex items-center gap-[12px]">
                <Text type="h" size={26} weight="bold" color="#FFFFFF">Ave</Text>
                <span class="text-[#444444] text-[20px]">/</span>
                <Text type="h" size={18} weight="medium" color="#666666">Docs</Text>
            </a>
        </div>

        <div class="flex-1 overflow-y-auto p-[20px] scrollbar-hide">
            <div class="flex flex-col gap-[4px]">
                <p class="text-[#555555] text-[11px] font-bold tracking-[0.1em] mb-[10px] px-[12px]">OAUTH INTEGRATION</p>
                {#each sections as section}
                    <button 
                        class="text-left px-[16px] py-[12px] rounded-[10px] text-[16px] transition-all duration-200 {activeSection === section.id ? 'bg-[#1a1a1a] text-[#FFFFFF] font-medium' : 'text-[#777777] hover:text-[#CCCCCC] hover:bg-[#111111]'}"
                        onclick={() => scrollToSection(section.id)}
                    >
                        {section.title}
                    </button>
                {/each}
            </div>
        </div>

        <div class="p-[20px] border-t border-[#161616]">
            <a href="/" use:route class="text-[#555555] hover:text-[#FFFFFF] text-[14px] transition-colors flex items-center gap-[8px]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back to Ave
            </a>

            <div class="mt-[12px] flex items-center gap-[10px] text-[13px] text-[#444444]">
                <a href="https://github.com/Lantharos/Ave" target="_blank" class="hover:text-[#888888] transition-colors">GitHub</a>
                <span class="opacity-60">·</span>
                <a href="https://github.com/Lantharos/Ave/blob/main/LICENSE" target="_blank" class="hover:text-[#888888] transition-colors">AGPL-3.0</a>
            </div>
        </div>
    </nav>

    <main bind:this={mainContent} class="flex-1 overflow-y-auto">
        <div class="max-w-[1000px] mx-auto px-6 md:px-[60px] py-12 md:py-[80px]">
            <div class="mb-12 md:mb-[80px] mt-8 md:mt-0">
                <h1 class="font-bold text-white text-3xl md:text-[56px]">OAuth Integration</h1>
                <p class="text-[#777777] text-base md:text-[20px] mt-4 md:mt-[16px] leading-relaxed">
                    Let users sign in with their Ave identity. Secure, privacy-focused, and optionally end-to-end encrypted.
                </p>
            </div>

            <div class="flex flex-col gap-12 md:gap-[80px]">
                <DocSec title="Overview" id="overview">
                    <div class="p-[24px] bg-[#111118] border border-[#252535] rounded-[12px] mb-[30px]">
                        <div class="flex items-center gap-[10px] mb-[10px]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8888ff" stroke-width="2">
                                <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2a4 4 0 0 1 4-4z"/>
                                <path d="M12 8v4m0 0l-2 6h4l-2-6z"/>
                                <circle cx="12" cy="18" r="4"/>
                            </svg>
                            <p class="text-[#aaaaff] text-[16px] font-semibold">Using an AI Agent?</p>
                        </div>
                        <p class="text-[#888899] text-[15px] leading-[1.7] mb-[14px]">
                            Give them the machine-readable docs instead:
                        </p>
                        <code class="block bg-[#0a0a10] text-[#ccccff] px-[16px] py-[12px] rounded-[8px] text-[14px] mb-[14px] select-all">https://aveid.net/llms.txt</code>
                        <p class="text-[#666677] text-[13px] leading-[1.6]">
                            <span class="text-[#888899]">Sample prompt:</span> "Please integrate Ave OAuth into my app. Here's the documentation: https://aveid.net/llms.txt"
                        </p>
                    </div>

                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        Ave provides OAuth 2.0 authentication that lets your app authenticate users with their Ave identity. Unlike traditional OAuth providers, Ave is built with privacy at its core:
                    </p>
                    <ul class="list-disc list-inside mt-[20px] space-y-[12px] text-[#999999] text-[17px]">
                        <li><strong class="text-[#DDDDDD]">No tracking</strong> - Ave doesn't track users across apps</li>
                        <li><strong class="text-[#DDDDDD]">User controls data</strong> - Users choose exactly what to share</li>
                        <li><strong class="text-[#DDDDDD]">Multiple identities</strong> - Users can have up to 5 identities and choose which one to use</li>
                        <li><strong class="text-[#DDDDDD]">Optional E2EE</strong> - Apps can request encryption keys for end-to-end encrypted data</li>
                    </ul>

                    <div class="mt-[30px] p-[24px] bg-[#0f0f0f] border border-[#1f1f1f] rounded-[12px]">
                        <p class="text-[#888888] text-[16px] leading-[1.7]">
                            <strong class="text-[#BBBBBB]">Developer Portal:</strong> Manage OAuth apps at <code>https://devs.aveid.net</code> (create apps, rotate secrets, and configure redirect URIs).

                        </p>
                    </div>
                </DocSec>

                <DocSec title="Getting Started" id="getting-started">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        To integrate Ave authentication into your app, you'll need:
                    </p>

                    <div class="mt-[24px] flex flex-col gap-[12px]">
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[8px]">1. CLIENT ID</p>
                            <p class="text-[#CCCCCC] text-[16px]">A unique identifier for your app (e.g., <code>app_4b21fc0238997355...</code>)</p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[8px]">2. CLIENT SECRET (optional)</p>
                            <p class="text-[#CCCCCC] text-[16px]">For server-side apps. Public clients (SPAs, mobile) use PKCE instead.</p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[8px]">3. REDIRECT URI</p>
                            <p class="text-[#CCCCCC] text-[16px]">Where Ave sends users after authorization (must be pre-registered)</p>
                        </div>
                    </div>

                    <p class="text-[#999999] text-[17px] mt-[30px] leading-[1.8]">
                        Ave supports two authentication methods:
                    </p>
                    <ul class="list-disc list-inside mt-[16px] space-y-[10px] text-[#999999] text-[17px]">
                        <li><strong class="text-[#DDDDDD]">Client Secret</strong> - For server-side apps that can securely store secrets</li>
                        <li><strong class="text-[#DDDDDD]">PKCE (Proof Key for Code Exchange)</strong> - For SPAs, mobile apps, and any public client</li>
                    </ul>
                </DocSec>

                <DocSec title="Authorization Flow" id="authorization-flow">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        Ave supports OAuth 2.0 + OpenID Connect using the Authorization Code flow:
                    </p>


                    <div class="mt-[30px] flex flex-col gap-[24px]">
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#222222] flex items-center justify-center text-[#FFFFFF] text-[14px] font-bold shrink-0">1</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[17px] font-semibold">Redirect to Ave</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">Send the user to Ave's authorization page with your app details</p>
                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#222222] flex items-center justify-center text-[#FFFFFF] text-[14px] font-bold shrink-0">2</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[17px] font-semibold">User Authorizes</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">The user selects an identity and swipes to sign in</p>

                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#222222] flex items-center justify-center text-[#FFFFFF] text-[14px] font-bold shrink-0">3</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[17px] font-semibold">Receive Authorization Code</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">Ave redirects back to your app with a temporary authorization code</p>
                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#222222] flex items-center justify-center text-[#FFFFFF] text-[14px] font-bold shrink-0">4</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[17px] font-semibold">Exchange for Token</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">Your app exchanges the code for an access token and user info</p>
                            </div>
                        </div>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[50px] mb-[16px]">Authorization URL</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        Redirect users to the Ave sign-in page (<code>/authorize</code> still works for backwards compatibility):
                    </p>

                    <CodeBlock code={`https://aveid.net/signin?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid%20profile%20email
  &state=RANDOM_STATE_VALUE
  &nonce=RANDOM_NONCE`} />


                    <div class="mt-[30px] overflow-x-auto">
                        <table class="w-full text-[15px]">
                            <thead>
                                <tr class="border-b border-[#222222]">
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Parameter</th>
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Required</th>
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Description</th>
                                </tr>
                            </thead>
                            <tbody class="text-[#888888]">
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>client_id</code></td>
                                    <td class="py-[14px]">Yes</td>
                                    <td class="py-[14px]">Your app's client ID</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>redirect_uri</code></td>
                                    <td class="py-[14px]">Yes</td>
                                    <td class="py-[14px]">Must match a registered redirect URI</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>scope</code></td>
                                    <td class="py-[14px]">No</td>
                                    <td class="py-[14px]">Requested permissions (default: <code>openid profile email</code>)</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>nonce</code></td>
                                    <td class="py-[14px]">Recommended</td>
                                    <td class="py-[14px]">Random string for ID token replay protection</td>
                                </tr>

                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>state</code></td>
                                    <td class="py-[14px]">Recommended</td>
                                    <td class="py-[14px]">Random string to prevent CSRF attacks</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>response_type</code></td>
                                    <td class="py-[14px]">No</td>
                                    <td class="py-[14px]">Always <code>code</code> for Ave</td>
                                </tr>

                            </tbody>
                        </table>
                    </div>
                </DocSec>

                <DocSec title="PKCE (Public Clients)" id="pkce">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        For single-page applications (SPAs), mobile apps, or any client that can't securely store a client secret, use PKCE (Proof Key for Code Exchange). This is the recommended approach for most modern apps.
                    </p>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[20px]">How PKCE Works</h3>
                    <div class="flex flex-col gap-[12px]">
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">1. GENERATE CODE VERIFIER</p>
                            <p class="text-[#999999] text-[15px]">Create a cryptographically random string (43-128 characters)</p>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">2. CREATE CODE CHALLENGE</p>
                            <p class="text-[#999999] text-[15px]">Hash the verifier with SHA-256 and base64url encode it</p>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">3. INCLUDE IN AUTH REQUEST</p>
                            <p class="text-[#999999] text-[15px]">Add <code>code_challenge</code> and <code>code_challenge_method=S256</code> to the URL</p>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">4. INCLUDE VERIFIER IN TOKEN REQUEST</p>
                            <p class="text-[#999999] text-[15px]">Send the original <code>code_verifier</code> when exchanging the code for tokens</p>
                        </div>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">PKCE Implementation</h3>
                    <CodeBlock code={`// Generate code verifier (random 32 bytes, base64url encoded)
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Generate code challenge (SHA-256 hash of verifier)
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// Base64 URL encoding (no padding, URL-safe characters)
function base64UrlEncode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Authorization URL with PKCE</h3>
                    <CodeBlock code={`https://aveid.net/signin?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid%20profile%20email
  &state=RANDOM_STATE_VALUE
  &nonce=RANDOM_NONCE
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8...
  &code_challenge_method=S256`} />
                </DocSec>

                <DocSec title="SDKs & Embed" id="sdks">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        Ave ships official SDKs plus an embed widget to make integration faster.
                    </p>
                    <div class="mt-[24px] grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] font-semibold">@ave-id/sdk</p>
                            <p class="text-[#888888] text-[14px] mt-[6px]">PKCE helpers, token exchange, userinfo, and server helpers.</p>
                            <code class="block mt-[12px] text-[#ccccff]">npm install @ave-id/sdk</code>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] font-semibold">@ave-id/embed</p>
                            <p class="text-[#888888] text-[14px] mt-[6px]">Inline iframe, modal sheet, or popup sign-in (postMessage callbacks).</p>
                            <code class="block mt-[12px] text-[#ccccff]">npm install @ave-id/embed</code>
                        </div>
                    </div>
                    <div class="mt-[24px]">
                        <CodeBlock code={`// Client (PKCE)
import { startPkceLogin } from "@ave-id/sdk/client";

await startPkceLogin({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
});`} />
                    </div>
                    <div class="mt-[24px]">
                        <CodeBlock code={`// Server
import { exchangeCodeServer } from "@ave-id/sdk/server";

const tokens = await exchangeCodeServer({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: process.env.AVE_SECRET,
  redirectUri: "https://yourapp.com/callback",
}, {
  code: "CODE_FROM_CALLBACK",
});`} />
                    </div>
                    <div class="mt-[24px]">
                        <CodeBlock code={`// Embed (inline iframe / sheet / popup)
 import { mountAveEmbed, openAveSheet, openAvePopup } from "@ave-id/embed";

 // Inline iframe
 mountAveEmbed({
   container: document.getElementById("ave-embed"),
   clientId: "YOUR_CLIENT_ID",
   redirectUri: "https://yourapp.com/callback",
   onSuccess: ({ redirectUrl }) => (window.location.href = redirectUrl),
 });

 // Modal sheet (mobile-friendly)
 openAveSheet({
   clientId: "YOUR_CLIENT_ID",
   redirectUri: "https://yourapp.com/callback",
   onSuccess: ({ redirectUrl }) => (window.location.href = redirectUrl),
 });

 // Popup (desktop)
 openAvePopup({
   clientId: "YOUR_CLIENT_ID",
   redirectUri: "https://yourapp.com/callback",
   onSuccess: ({ redirectUrl }) => (window.location.href = redirectUrl),
 });`} />
                    </div>
                </DocSec>


                <DocSec title="End-to-End Encryption" id="e2ee">
                    <div class="p-[28px] bg-[#0a1a0f] border-[2px] border-[#1a4a2a] rounded-[16px] mb-[30px]">
                        <div class="flex items-center gap-[12px] mb-[12px]">
                            <svg width="24" height="24" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.5 15V10.5C10.5 8.51088 11.2902 6.60322 12.6967 5.1967C14.1032 3.79018 16.0109 3 18 3C19.9891 3 21.8968 3.79018 23.3033 5.1967C24.7098 6.60322 25.5 8.51088 25.5 10.5V15M19.5 24C19.5 24.8284 18.8284 25.5 18 25.5C17.1716 25.5 16.5 24.8284 16.5 24C16.5 23.1716 17.1716 22.5 18 22.5C18.8284 22.5 19.5 23.1716 19.5 24ZM7.5 15H28.5C30.1569 15 31.5 16.3431 31.5 18V30C31.5 31.6569 30.1569 33 28.5 33H7.5C5.84315 33 4.5 31.6569 4.5 30V18C4.5 16.3431 5.84315 15 7.5 15Z" stroke="#32A94C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <p class="text-[#32A94C] text-[18px] font-semibold">End-to-End Encryption</p>
                        </div>
                        <p class="text-[#5a9a6a] text-[15px] leading-[1.7]">
                            Apps can request encryption keys from Ave, enabling true end-to-end encrypted data that neither Ave nor your servers can read.
                        </p>
                    </div>

                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        When your app has E2EE enabled, Ave provides an app-specific encryption key during each login. This key is:
                    </p>
                    <ul class="list-disc list-inside mt-[20px] space-y-[12px] text-[#999999] text-[17px]">
                        <li><strong class="text-[#DDDDDD]">Unique to your app</strong> - Each app gets its own key per user identity</li>
                        <li><strong class="text-[#DDDDDD]">Controlled by the user</strong> - Encrypted with the user's master key on Ave's servers</li>
                        <li><strong class="text-[#DDDDDD]">Passed securely</strong> - Delivered via URL fragment (never logged by servers)</li>
                        <li><strong class="text-[#DDDDDD]">Persistent</strong> - Same key is provided on subsequent logins with the same identity</li>
                    </ul>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[20px]">How It Works</h3>
                    <div class="flex flex-col gap-[20px]">
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#1a3a2a] flex items-center justify-center text-[#32A94C] text-[14px] font-bold shrink-0">1</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[16px] font-semibold">First Authorization</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">Ave generates a new AES-256-GCM key for your app. The key is encrypted with the user's master key and stored on Ave.</p>
                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#1a3a2a] flex items-center justify-center text-[#32A94C] text-[14px] font-bold shrink-0">2</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[16px] font-semibold">Key Delivery</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">After authorization, Ave decrypts the key client-side and passes it to your app via the URL fragment (<code>#app_key=...</code>)</p>
                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#1a3a2a] flex items-center justify-center text-[#32A94C] text-[14px] font-bold shrink-0">3</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[16px] font-semibold">Encrypt User Data</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">Your app uses the key to encrypt/decrypt user data. Encrypted data can be stored anywhere.</p>
                            </div>
                        </div>
                        <div class="flex gap-[20px] items-start">
                            <div class="w-[36px] h-[36px] rounded-full bg-[#1a3a2a] flex items-center justify-center text-[#32A94C] text-[14px] font-bold shrink-0">4</div>
                            <div>
                                <p class="text-[#FFFFFF] text-[16px] font-semibold">Subsequent Logins</p>
                                <p class="text-[#888888] text-[15px] mt-[4px]">When the user logs in again with the same identity, they receive the same key.</p>
                            </div>
                        </div>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">Identity-Specific Keys</h3>
                    <p class="text-[#999999] text-[16px] leading-[1.8]">
                        Each identity gets its own encryption key. If a user has multiple identities (e.g., personal and work), each identity will have separate encrypted data in your app.
                    </p>
                    <div class="mt-[20px] p-[20px] bg-[#1a1212] border border-[#2a1a1a] rounded-[12px]">
                        <p class="text-[#aa8888] text-[15px]">
                            <strong class="text-[#E14747]">Important:</strong> Store user data keyed by the identity ID, not just the user. This ensures data separation when users switch between identities.
                        </p>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Receiving the App Key</h3>
                    <CodeBlock code={`// After OAuth redirect, extract the app key from the URL fragment
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const appKeyBase64 = hashParams.get('app_key');

if (appKeyBase64) {
  // Import the key for use with Web Crypto API
  const keyBytes = Uint8Array.from(atob(appKeyBase64), c => c.charCodeAt(0));
  const appKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Clean URL to remove the key from browser history
  window.history.replaceState({}, document.title, window.location.pathname);
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Encrypting Data</h3>
                    <CodeBlock code={`async function encryptData(key, plaintext) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(key, encryptedBase64) {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}`} />
                </DocSec>

                <DocSec title="Ave Signing" id="signing">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        Ave Signing lets users cryptographically sign messages with their Ave identity. This is useful for verifiable consent, high-integrity actions, and any workflow where you need proof that a specific identity approved a message.
                    </p>

                    <div class="mt-[24px] p-[20px] bg-[#0f0f0f] border border-[#1f1f1f] rounded-[12px]">
                        <p class="text-[#888888] text-[15px] leading-[1.7]">
                            Each identity has an Ed25519 keypair. The private key is generated client-side and stored on Ave encrypted with the user’s master key (Ave can’t read it).
                        </p>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[20px]">How It Works</h3>
                    <div class="flex flex-col gap-[12px]">
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">1. CREATE REQUEST</p>
                            <p class="text-[#999999] text-[15px]">Your server creates a signature request with a message payload.</p>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">2. USER SIGNS</p>
                            <p class="text-[#999999] text-[15px]">Ave shows a signing sheet and the user approves (passkey) or denies.</p>
                        </div>
                        <div class="p-[20px] bg-[#0f0f0f] rounded-[12px] border border-[#1a1a1a]">
                            <p class="text-[#666666] text-[12px] font-bold tracking-[0.1em] mb-[6px]">3. VERIFY</p>
                            <p class="text-[#999999] text-[15px]">Your app verifies the signature using the identity’s public key.</p>
                        </div>
                    </div>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Create a Signature Request</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        Signature requests are created server-side using your app credentials.
                    </p>
                    <CodeBlock code={`POST https://api.aveid.net/api/signing/request
Content-Type: application/json

{
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "identityId": "IDENTITY_UUID",
  "payload": "I approve transferring $100 to Example Inc.",
  "metadata": { "action": "transfer", "amount": 100 },
  "expiresInSeconds": 300
}

// Response
{
  "requestId": "REQUEST_UUID",
  "expiresAt": "2026-01-25T12:34:56.000Z",
  "publicKey": "BASE64_PUBLIC_KEY"
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Open the Signing UI</h3>
                    <CodeBlock code={`import { openAveSigningSheet, openAveSigningPopup } from "@ave-id/embed";

// Mobile-friendly bottom sheet
openAveSigningSheet({
  requestId: "REQUEST_UUID",
  onSigned: ({ requestId, signature, publicKey }) => {
    console.log("Signed", requestId, signature);
  },
  onDenied: ({ requestId }) => {
    console.log("Denied", requestId);
  }
});

// Desktop popup
openAveSigningPopup({
  requestId: "REQUEST_UUID",
  onSigned: ({ requestId, signature, publicKey }) => {
    console.log("Signed", requestId, signature);
  }
});`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Poll for Status</h3>
                    <CodeBlock code={`GET https://api.aveid.net/api/signing/request/REQUEST_UUID/status?clientId=YOUR_CLIENT_ID

// Response
{
  "status": "pending" | "signed" | "denied" | "expired",
  "signature": "BASE64_SIGNATURE" | null,
  "resolvedAt": "2026-01-25T12:34:56.000Z" | null
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[16px]">Verify a Signature</h3>
                    <CodeBlock code={`POST https://api.aveid.net/api/signing/verify
Content-Type: application/json

{
  "message": "I approve transferring $100 to Example Inc.",
  "signature": "BASE64_SIGNATURE",
  "publicKey": "BASE64_PUBLIC_KEY"
}

// Response
{ "valid": true }`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">Get Public Key by Handle</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        You can also fetch the signing public key by identity handle.
                    </p>
                    <CodeBlock code={`GET https://api.aveid.net/api/signing/public-key/kristof

// Response
{
  "handle": "kristof",
  "publicKey": "BASE64_PUBLIC_KEY",
  "createdAt": "2026-01-25T12:34:56.000Z"
}`} />
                </DocSec>

                <DocSec title="API Endpoints" id="endpoints">
                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mb-[12px]">Authorization Endpoint</h3>
                    <p class="text-[#999999] text-[16px]">
                        <code>GET /authorize</code> - User-facing authorization page
                    </p>

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">Token Endpoint</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        <code>POST https://api.aveid.net/api/oauth/token</code> - Exchange authorization code or refresh token for tokens (returns both opaque and JWT access tokens)
                    </p>


                    <div class="mt-[16px] mb-[24px] p-[20px] bg-[#1a1212] border border-[#2a1a1a] rounded-[12px]">
                        <p class="text-[#aa8888] text-[15px]">
                            <strong class="text-[#E14747]">Important:</strong> The API base URL is <code>api.aveid.net</code>, NOT <code>aveid.net/api</code>. Request body fields must use <strong>camelCase</strong> (e.g., <code>grantType</code>, <code>clientId</code>).
                        </p>
                    </div>
                    <CodeBlock code={`// Request
POST https://api.aveid.net/api/oauth/token
Content-Type: application/json

{
  "grantType": "authorization_code",
  "code": "AUTHORIZATION_CODE",
  "redirectUri": "https://yourapp.com/callback",
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_SECRET",    // For confidential clients
  "codeVerifier": "PKCE_VERIFIER"   // For PKCE clients
}`} />

                    <CodeBlock code={`// Response
{
  "access_token": "opaque_token",
  "access_token_jwt": "eyJhbGciOiJSUzI1NiIs...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "rt_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "handle": "johndoe",
    "displayName": "John Doe",
    "email": "john@example.com",
    "avatarUrl": "https://..."
  },
  "encrypted_app_key": "..."  // Only for E2EE apps
}`} />


                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">App Info Endpoint</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        <code>GET https://api.aveid.net/api/oauth/app/:clientId</code> - Get public app information
                    </p>
                    <CodeBlock code={`// Response
{
  "app": {
    "name": "My App",
    "description": "An awesome app",
    "iconUrl": "https://...",
    "websiteUrl": "https://myapp.com",
    "supportsE2ee": true
  }
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">Userinfo Endpoint</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        <code>GET https://api.aveid.net/api/oauth/userinfo</code> - Fetch OpenID profile claims (works with opaque or JWT access tokens)
                    </p>
                    <CodeBlock code={`// Request
GET https://api.aveid.net/api/oauth/userinfo
Authorization: Bearer ACCESS_TOKEN

// Response
{
  "sub": "identity_uuid",
  "name": "John Doe",
  "preferred_username": "johndoe",
  "email": "john@example.com",
  "picture": "https://...",
  "iss": "https://aveid.net"
}`} />

                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mt-[40px] mb-[12px]">Discovery & JWKS</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        <code>GET https://api.aveid.net/.well-known/openid-configuration</code> and <code>GET https://api.aveid.net/.well-known/jwks.json</code>
                    </p>
                </DocSec>


                <DocSec title="User Data" id="user-data">
                    <p class="text-[#999999] text-[17px] leading-[1.8]">
                        When a user authorizes your app, you receive information about their selected identity:
                    </p>

                    <div class="mt-[24px] overflow-x-auto">
                        <table class="w-full text-[15px]">
                            <thead>
                                <tr class="border-b border-[#222222]">
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Field</th>
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Type</th>
                                    <th class="text-left py-[14px] text-[#AAAAAA] font-semibold">Description</th>
                                </tr>
                            </thead>
                            <tbody class="text-[#888888]">
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>id</code></td>
                                    <td class="py-[14px]">UUID</td>
                                    <td class="py-[14px]">Unique identifier for this identity</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>handle</code></td>
                                    <td class="py-[14px]">String</td>
                                    <td class="py-[14px]">Unique username (e.g., "johndoe")</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>displayName</code></td>
                                    <td class="py-[14px]">String</td>
                                    <td class="py-[14px]">User's display name</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>email</code></td>
                                    <td class="py-[14px]">String | null</td>
                                    <td class="py-[14px]">Email address (if provided)</td>
                                </tr>
                                <tr class="border-b border-[#1a1a1a]">
                                    <td class="py-[14px]"><code>avatarUrl</code></td>
                                    <td class="py-[14px]">String | null</td>
                                    <td class="py-[14px]">URL to user's avatar image</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-[30px] p-[20px] bg-[#0f0f0f] border border-[#1f1f1f] rounded-[12px]">
                        <p class="text-[#888888] text-[15px]">
                            <strong class="text-[#BBBBBB]">Note:</strong> The <code>id</code> is the identity ID, not the user ID. If a user logs in with a different identity, they'll have a different ID.
                        </p>
                    </div>
                </DocSec>

                <DocSec title="Security Best Practices" id="security">
                    <div class="flex flex-col gap-[16px]">
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Always Validate State</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                Generate a random <code>state</code> parameter before redirecting and verify it matches when the user returns. This prevents CSRF attacks.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Use PKCE for Public Clients</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                Never embed client secrets in frontend code. Use PKCE (S256 method) for SPAs and mobile apps.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Verify ID Tokens</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                Validate ID tokens using the JWKS from <code>/.well-known/jwks.json</code> and check <code>iss</code>, <code>aud</code>, and <code>exp</code>.
                            </p>

                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Secure Token Storage</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                Store access tokens securely. In browsers, use memory or httpOnly cookies. Never store in localStorage for sensitive apps.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Clean URL Fragments</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                For E2EE apps, immediately extract the app key from the URL fragment and clean the URL to prevent the key from appearing in browser history.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#0f0f0f] rounded-[14px] border border-[#1a1a1a]">
                            <p class="text-[#FFFFFF] text-[17px] font-semibold mb-[8px]">Register Exact Redirect URIs</p>
                            <p class="text-[#888888] text-[15px] leading-[1.7]">
                                Register the full redirect URI including path. Don't use wildcards. This prevents open redirect vulnerabilities.
                            </p>
                        </div>
                    </div>
                </DocSec>

                <DocSec title="Common Mistakes" id="common-mistakes">
                    <p class="text-[#999999] text-[17px] leading-[1.8] mb-[24px]">
                        Avoid these common integration pitfalls:
                    </p>
                    <div class="flex flex-col gap-[16px]">
                        <div class="p-[24px] bg-[#1a1212] rounded-[14px] border border-[#2a1a1a]">
                            <p class="text-[#E14747] text-[17px] font-semibold mb-[8px]">Wrong API URL</p>
                            <p class="text-[#aa8888] text-[15px] leading-[1.7]">
                                Use <code>https://api.aveid.net/api/oauth/token</code>, NOT <code>https://aveid.net/api/oauth/token</code>. The API is hosted on a separate subdomain.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#1a1212] rounded-[14px] border border-[#2a1a1a]">
                            <p class="text-[#E14747] text-[17px] font-semibold mb-[8px]">Wrong Field Names in Token Request</p>
                            <p class="text-[#aa8888] text-[15px] leading-[1.7]">
                                Use camelCase: <code>grantType</code>, <code>clientId</code>, <code>clientSecret</code>, <code>redirectUri</code>, <code>codeVerifier</code>, <code>refreshToken</code>. NOT snake_case like <code>grant_type</code>.
                            </p>
                        </div>

                        <div class="p-[24px] bg-[#1a1212] rounded-[14px] border border-[#2a1a1a]">
                            <p class="text-[#E14747] text-[17px] font-semibold mb-[8px]">App Key Parsing Error</p>
                            <p class="text-[#aa8888] text-[15px] leading-[1.7]">
                                When extracting <code>app_key</code> from the URL fragment with <code>URLSearchParams</code>, the <code>+</code> character in base64 becomes a space. Replace spaces back to <code>+</code> before decoding.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#1a1212] rounded-[14px] border border-[#2a1a1a]">
                            <p class="text-[#E14747] text-[17px] font-semibold mb-[8px]">Expecting JWT from Ave</p>
                            <p class="text-[#aa8888] text-[15px] leading-[1.7]">
                                Ave's <code>access_token</code> is opaque, not a JWT. If you need a JWT for your app's session management, create your own after validating the Ave token.
                            </p>
                        </div>
                        <div class="p-[24px] bg-[#1a1212] rounded-[14px] border border-[#2a1a1a]">
                            <p class="text-[#E14747] text-[17px] font-semibold mb-[8px]">Storing Profile Data Locally</p>
                            <p class="text-[#aa8888] text-[15px] leading-[1.7]">
                                User profile data (avatar, display name) is managed by Ave. Fetch fresh data on each login or link users to Ave for profile edits.
                            </p>
                        </div>
                    </div>
                </DocSec>

                <DocSec title="Code Examples" id="examples">
                    <h3 class="text-[#FFFFFF] text-[22px] font-semibold mb-[12px]">Complete OIDC PKCE Flow Example</h3>
                    <p class="text-[#999999] text-[16px] mb-[16px]">
                        A complete example of implementing Ave OIDC with PKCE:
                    </p>

                     <CodeBlock code={`// Configuration
const AVE_AUTH_URL = 'https://aveid.net/signin';
const AVE_TOKEN_URL = 'https://api.aveid.net/api/oauth/token';
const CLIENT_ID = 'your_client_id';
const REDIRECT_URI = 'https://yourapp.com/callback';

// Start login
async function loginWithAve() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);
  
  // Store for later verification
  sessionStorage.setItem('code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_nonce', nonce);
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state: state,
    nonce: nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  window.location.href = AVE_AUTH_URL + '?' + params.toString();
}

// Handle callback
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  
  // Verify state
  if (state !== sessionStorage.getItem('oauth_state')) {
    throw new Error('State mismatch - possible CSRF attack');
  }
  
  // Exchange code for token
  const response = await fetch(AVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'authorization_code',
      code: code,
      redirectUri: REDIRECT_URI,
      clientId: CLIENT_ID,
      codeVerifier: sessionStorage.getItem('code_verifier')
    })
  });
  
  const data = await response.json();
  
  // Clean up
  sessionStorage.removeItem('code_verifier');
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('oauth_nonce');
  
  console.log('Logged in as:', data.user.displayName);
  
  // For E2EE apps, extract the app key from URL fragment
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const appKey = hashParams.get('app_key');
  if (appKey) {
    console.log('Received app encryption key');
    window.history.replaceState({}, '', window.location.pathname);
  }
}`} />

                </DocSec>
            </div>

            <div class="mt-[100px] pt-[40px] border-t border-[#1a1a1a]">
                <p class="text-[#555555] text-[14px]">
                    Need help? Contact us at <a href="mailto:hello@lantharos.com" class="text-[#888888] hover:text-white transition-colors">hello@lantharos.com</a>
                </p>
            </div>
        </div>
    </main>
</div>

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    /* Hide scrollbar for IE, Edge and Firefox */
    .scrollbar-hide {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
</style>
