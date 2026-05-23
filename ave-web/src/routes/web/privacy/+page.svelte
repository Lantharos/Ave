<script lang="ts">
    import AuroraBackdrop from "$lib/surfaces/web/components/AuroraBackdrop.svelte";
    import LegalSec from "../_components/LegalSec.svelte";
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed flex flex-col relative overflow-hidden">
    <AuroraBackdrop preset="privacy" cclass="absolute top-0 left-0 w-full pointer-events-none select-none z-0" />
    <div class="self-center mt-12 md:mt-[100px] px-6 md:px-0 text-center relative z-10">
        <h1 class="font-bold text-white text-4xl md:text-[96px]">Privacy Policy</h1>
        <p class="font-medium text-[#D3D3D3] text-lg md:text-[36px] mt-2 md:mt-0">Last updated May 11, 2026</p>
    </div>

    <div class="w-full md:w-[60%] self-center flex flex-col gap-12 md:gap-[80px] mt-16 md:mt-[120px] mb-12 md:mb-[100px] px-6 md:px-0 relative z-10">
        <LegalSec title="Overview">
            Ave is an identity and authorization service operated by Lantharos. This policy explains what Ave stores, what stays on your device, what connected apps can receive, and how to ask us about your data.
            <br><br>
            We do not sell personal information, run third-party ad tracking, or use your Ave data to build advertising profiles. We do process account, device, security, and authorization metadata because the service cannot work without it.
            <br><br>
            Contact us about privacy at data@lantharos.com.
        </LegalSec>
        <LegalSec title="Account Data">
            When you create or use an Ave account, we store:
            * Your user ID and identity IDs.
            * Your display name, handle, optional verified email, optional birthday, avatar URL, and banner URL or color.
            * Passkey credential IDs, public keys, counters, transports, device type, backup status, friendly passkey names, and encrypted PRF master-key material when supported by your passkey.
            * Trusted device records, including device name, type, browser, operating system, last seen time, local device fingerprint, and optional push subscription.
            * Session records with hashed session tokens, expiration time, authentication method, IP address, and user agent.
            * Recovery-code records as hashes only. We do not store the recovery code text after it is shown to you.
            * Encrypted master-key backups, encrypted identity private keys, signing public keys, encrypted signing private keys, and encrypted per-app keys.
            <br><br>
            Your handle, display name, verified email, birthday, avatar URL, and banner URL are readable by Ave servers. Encrypted key material is stored so Ave can help you recover or use keys, but we do not have the plaintext master key needed to decrypt it.
        </LegalSec>
        <LegalSec title="Security Data">
            We collect IP addresses, user agents, request timing, and event details for authentication, rate limiting, abuse prevention, account activity, and security investigation. This includes events such as account creation, login, passkey changes, recovery-code use, device changes, identity updates, OAuth authorization, authorization revocation, exports, and deletion attempts.
            <br><br>
            Activity logs are kept for about 5 days and then removed by scheduled cleanup. Stale trusted devices are removed after about 14 days without being seen. Login approval requests expire after about 5 minutes. Email verification codes expire after about 15 minutes. Sessions normally last up to 30 days and may be refreshed while you keep using Ave.
        </LegalSec>
        <LegalSec title="Browser Storage">
            Ave stores some data in your browser so sign-in and encryption can work:
            * Your master key is stored in IndexedDB when available, with a localStorage fallback for older browser paths.
            * A local device fingerprint is stored in localStorage to recognize the browser as the same trusted device.
            * Short-lived OAuth, PKCE, route return, and database bookmark values may be stored in sessionStorage.
            <br><br>
            The Ave SDK may also store PKCE state in sessionStorage. Quick Ave integrations can store an identity and token data in the connected app's localStorage; that storage belongs to the connected app, not to the Ave dashboard.
        </LegalSec>
        <LegalSec title="Uploads">
            If you upload an avatar, banner, or workspace logo, the image is stored in object storage and served from Ave's public asset domain. Anyone with the asset URL may be able to view it.
            <br><br>
            Replacing or deleting an avatar or banner removes the old object when Ave can identify it. Account deletion removes the account database records, but public asset caches and copies already fetched by browsers, CDNs, or connected apps may remain until they expire or are separately removed.
        </LegalSec>
        <LegalSec title="Connected Apps">
            When you authorize an app, Ave shares only the scopes you approve or that the flow requires:
            * "openid" gives the app your stable identity ID.
            * "profile" can include display name, handle, and avatar URL.
            * "email" can include your verified email address.
            * "offline_access" lets the app receive refresh tokens so it can keep a session.
            * "user_id" can include your account-level user ID, but only for apps allowed to request it.
            <br><br>
            Apps may also receive OAuth access tokens, ID tokens, connector delegation tokens, and, for E2EE app flows, app keys through the browser flow after you approve access. Revoke access from your dashboard to stop future Ave-issued access, but connected apps may keep data they already received under their own privacy policies.
        </LegalSec>
        <LegalSec title="Developer Portal">
            Developers and workspace members can create apps, resources, redirect URIs, client credentials, workspace names, workspace logos, verified domains, and team invitations. The developer portal also shows app-level counts, recent authorization activity, connected identities for the app, refresh-token activity, revocations, connector grants, and delegation audit logs.
            <br><br>
            Developer app records, workspace records, OAuth authorizations, refresh-token hashes, connector grants, and delegation audit logs are kept while they are needed to operate the service, until the relevant account, workspace, app, authorization, or grant is deleted or revoked, unless we need to keep limited records for security or legal reasons.
        </LegalSec>
        <LegalSec title="Service Providers">
            Ave uses infrastructure and service providers to operate the service. This includes Cloudflare for hosting, Workers, D1, Durable Objects, R2 object storage, caching, and network security, and Resend for email verification messages. Browser push notifications also pass through the push service used by your browser or operating system.
            <br><br>
            These providers process data for Ave so the service can run. We do not share Ave data with data brokers or advertising networks.
        </LegalSec>
        <LegalSec title="Legal Requests">
            We may disclose information if required by law, court order, or a valid government request. We will limit what we provide to what we believe is legally required.
            <br><br>
            Some data is encrypted in a way that Ave cannot decrypt because we do not hold your plaintext master key. If we cannot technically access plaintext key material or encrypted user-controlled data, we cannot provide it.
        </LegalSec>
        <LegalSec title="Your Controls">
            From the Ave dashboard, you can export your Ave data, update profile details, remove an email, revoke trusted devices, revoke connected apps, revoke connector grants, disable push notifications, delete non-primary identities, and delete your account.
            <br><br>
            Account deletion is permanent for Ave account records and breaks future Ave access for connected apps. It does not delete data that connected apps already copied, messages you sent us by email, public asset copies already cached outside our direct control, or records we must keep for security, fraud prevention, compliance, or dispute handling.
        </LegalSec>
        <LegalSec title="Privacy Rights">
            Depending on where you live, you may have rights to know, access, correct, delete, export, or limit certain uses of your personal information. You can exercise many of these controls directly in the dashboard or contact data@lantharos.com.
            <br><br>
            We do not discriminate against you for using privacy rights. We do not sell personal information or share it for cross-context behavioral advertising.
        </LegalSec>
        <LegalSec title="Children">
            Ave is not directed to children. If you believe a child provided personal information without the consent required by local law, contact data@lantharos.com so we can review and delete it where appropriate.
        </LegalSec>
        <LegalSec title="Changes">
            We may update this policy as Ave changes. When we make material changes, we will update the date above and use a reasonable notice method, such as the website or dashboard.
        </LegalSec>
    </div>
</div>
