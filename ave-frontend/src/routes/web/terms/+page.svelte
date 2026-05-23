<script lang="ts">
    import AuroraBackdrop from "$lib/surfaces/web/components/AuroraBackdrop.svelte";
    import LegalSec from "../_components/LegalSec.svelte";
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed flex flex-col relative overflow-hidden">
    <AuroraBackdrop preset="terms" cclass="absolute top-0 left-0 w-full pointer-events-none select-none z-0" />
    <div class="self-center mt-12 md:mt-[100px] px-6 md:px-0 text-center relative z-10">
        <h1 class="font-bold text-white text-4xl md:text-[96px]">Terms of Service</h1>
        <p class="font-medium text-[#D3D3D3] text-lg md:text-[36px] mt-2 md:mt-0">Last updated May 11, 2026</p>
    </div>

    <div class="w-full md:w-[60%] self-center flex flex-col gap-12 md:gap-[80px] mt-16 md:mt-[120px] mb-12 md:mb-[100px] px-6 md:px-0 relative z-10">
        <LegalSec title="Introduction">
            These Terms apply when you use Ave, including the hosted sign-in service, dashboard, developer portal, APIs, SDKs, and related websites. Ave is provided by Lantharos.
            <br><br>
            By using Ave, you agree to these Terms and to our Privacy Policy. If you use Ave for an organization, you confirm that you have authority to use Ave for that organization.
        </LegalSec>
        <LegalSec title="What Ave Does">
            Ave lets you create identities, sign in with passkeys and recovery methods, manage trusted devices, authorize apps with OAuth and OpenID Connect, use connector grants, manage developer apps and workspaces, and use identity-backed signing and encryption features.
            <br><br>
            Ave is an identity layer. It is not a social network, general file host, or backup service for data stored inside connected apps.
        </LegalSec>
        <LegalSec title="Who Can Use Ave">
            You may use Ave only if you are legally allowed to do so. If local law requires parent or guardian consent because of your age, you must have that consent before using Ave.
            <br><br>
            Connected apps may have their own age, regional, account, payment, or eligibility requirements. Their terms apply separately from these Terms.
        </LegalSec>
        <LegalSec title="Your Account">
            You are responsible for keeping your devices, passkeys, sessions, recovery codes, and developer credentials secure. Do not share recovery codes, client secrets, access tokens, refresh tokens, or private keys.
            <br><br>
            If you lose access to all trusted devices, passkeys, and valid recovery options, Ave may not be able to restore your account or decrypt user-controlled key material. This is a consequence of the security design, not a support limitation.
        </LegalSec>
        <LegalSec title="Your Data">
            You keep ownership of the content and profile information you provide to Ave. You give Ave the limited permission needed to operate the service, including storing, processing, securing, transmitting, displaying, and deleting data according to your settings and requests.
            <br><br>
            Some Ave data is readable by Ave servers, such as handles, display names, verified emails, birthdays, device metadata, security logs, app records, workspace records, and public upload URLs. Some key material is encrypted so Ave cannot read the plaintext. The Privacy Policy explains this in more detail.
        </LegalSec>
        <LegalSec title="Connected Apps">
            When you authorize a connected app, Ave may issue tokens and share approved identity fields with that app. The app is responsible for what it does with data after it receives it.
            <br><br>
            Revoking an authorization or connector grant stops future Ave-issued access where supported. It does not automatically delete data the connected app already received. Contact the connected app directly for its own data export or deletion process.
        </LegalSec>
        <LegalSec title="Developer Use">
            If you register an app, resource, redirect URI, workspace, or organization in Ave, you are responsible for the accuracy of that information, for protecting client secrets, and for requesting only the scopes your app needs.
            <br><br>
            You must present your own users with accurate information about how your app uses Ave and any data received from Ave. Do not misrepresent Ave, bypass consent screens, request scopes deceptively, or use tokens outside the permissions granted by the user and Ave.
        </LegalSec>
        <LegalSec title="Uploads">
            You may upload avatars, banners, and workspace logos. You are responsible for having the rights to upload and display those images.
            <br><br>
            Uploaded images may be public if someone has the asset URL. Do not upload private, illegal, infringing, abusive, or sensitive images unless you understand that public asset behavior.
        </LegalSec>
        <LegalSec title="Acceptable Use">
            You may not:
            * Access, test, or interfere with accounts, devices, data, apps, workspaces, systems, or tokens you do not control.
            * Use Ave to impersonate others, deceive users, distribute malware, spam, abuse infrastructure, evade rate limits, or facilitate illegal activity.
            * Attempt to degrade, scan, overload, scrape, reverse-engineer, or bypass Ave systems except as allowed for security research below or by applicable law.
            * Upload content that is illegal, infringing, abusive, or designed to harm the service or other users.
            <br><br>
            We may limit, suspend, or terminate access for abuse, fraud, security risk, legal risk, or material violation of these Terms.
        </LegalSec>
        <LegalSec title="Security Research">
            We welcome responsible security reports. If you believe you found a vulnerability, email security@lantharos.com and do not publish details before we have had a reasonable chance to investigate.
            <br><br>
            Security testing must be limited to your own accounts, apps, workspaces, and designated test data. Do not access another user's data, exfiltrate secrets, degrade service, persist beyond the test needed to demonstrate impact, or violate applicable law.
        </LegalSec>
        <LegalSec title="Deletion">
            You may delete your Ave account from the dashboard. Account deletion is permanent and can break access for connected apps that rely on your Ave identity.
            <br><br>
            Deletion removes Ave account records from the active database, subject to limitations described in the Privacy Policy. It does not remove data already copied by connected apps, public asset copies already cached outside Ave's direct control, emails you sent us, or records we must keep for security, compliance, fraud prevention, or dispute handling.
        </LegalSec>
        <LegalSec title="Availability">
            Ave is provided as available. We work to keep the service reliable, but we do not guarantee uninterrupted, error-free, or permanently available access.
            <br><br>
            We may change, suspend, remove, or limit features when needed for security, maintenance, legal compliance, product changes, or abuse prevention.
        </LegalSec>
        <LegalSec title="Liability">
            To the maximum extent allowed by law, Ave is provided "as is" and "as available." Lantharos is not liable for lost access caused by lost devices, lost passkeys, lost recovery codes, deleted keys, connected-app behavior, user error, unauthorized use of your credentials, or events outside our reasonable control.
            <br><br>
            Nothing in these Terms limits rights or liabilities that cannot be limited under applicable law.
        </LegalSec>
        <LegalSec title="Changes">
            We may update these Terms as Ave changes. If a change is material, we will use a reasonable notice method, such as the website or dashboard. Continued use after updated Terms take effect means you accept the updated Terms.
        </LegalSec>
        <LegalSec title="Disputes">
            <span class="font-bold">1. Mediation:</span>
            If a dispute arises out of or relates to these Terms or Ave, you and Lantharos agree to first try to resolve it informally and, if needed, through mediation with a neutral mediator agreed by both sides. If mediation does not resolve the dispute within 30 days, the matter may proceed to arbitration.
            <br><br>
            <span class="font-bold">2. Arbitration:</span>
            If mediation fails, unresolved disputes or claims will be settled through binding arbitration where permitted by law. The arbitration will be conducted by the German Arbitration Institute and will take place in Munich, Germany, unless both parties agree to conduct it online.
            * The arbitrator's decision will be final and binding, and judgment on the award may be entered in any court of competent jurisdiction.
            * Arbitration costs shall be shared equally by both parties, unless otherwise decided by the arbitrator.
            * Where permitted by law, you and Lantharos waive the right to a jury trial and to participate in a class action for claims covered by arbitration.
            <br><br>
            <span class="font-bold">3. Exceptions:</span>
            Claims for injunctive relief, intellectual-property misuse, unauthorized access, or matters that cannot legally be arbitrated may be brought in a court of competent jurisdiction.
        </LegalSec>
        <LegalSec title="Contact">
            Questions about these Terms can be sent to data@lantharos.com. Security reports should be sent to security@lantharos.com.
        </LegalSec>
    </div>
</div>
