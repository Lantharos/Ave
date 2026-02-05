<script lang="ts">
    import AuroraBackdrop from "../../../components/AuroraBackdrop.svelte";
    import Text from "../../../components/Text.svelte";
    import LegalSec from "./components/LegalSec.svelte";
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed flex flex-col relative overflow-hidden">
    <AuroraBackdrop preset="terms" cclass="absolute top-0 left-0 w-full pointer-events-none select-none z-0" />
    <div class="self-center mt-12 md:mt-[100px] px-6 md:px-0 text-center relative z-10">
        <h1 class="font-bold text-white text-4xl md:text-[96px]">Your Responsibilities</h1>
        <p class="font-medium text-[#D3D3D3] text-lg md:text-[36px] mt-2 md:mt-0">Here's what you agree to when using Ave</p>
    </div>

    <div class="w-full md:w-[60%] self-center flex flex-col gap-12 md:gap-[80px] mt-16 md:mt-[120px] mb-12 md:mb-[100px] px-6 md:px-0 relative z-10">
        <LegalSec title="Introduction">
            By using Ave, you agree to these terms. Ave is a secure identity platform provided by Lantharos to help you manage authentication across applications while maintaining full control over your data.
        </LegalSec>
        <LegalSec title="Our Service">
            Ave allows you to:
            * Create and manage a digital identity.
            * Authenticate across participating apps and platforms.
            * Manage connected devices and security layers (passkeys, trust codes, etc.).
            Ave is not a social network or cloud storage provider. You are responsible for managing your own credentials and recovery methods.
        </LegalSec>
        <LegalSec title="Who can use Ave?">
            Ave can be used by individuals of any age. However, some third-party services that integrate with Ave may impose their own age or regional restrictions.
            <br><br>
            You may not use Ave if you are prohibited from receiving such services under applicable laws.
        </LegalSec>
        <LegalSec title="Your Responsibilities">
            You agree to:
            * Keep your devices and passkeys secure.
            * Not share recovery codes or security answers.
            * Use Ave only for lawful purposes.
            If you lose access to all trusted devices and recovery options, Ave cannot restore your account due to end-to-end encryption. You acknowledge that key recovery is impossible without valid trust proofs.
        </LegalSec>
        <LegalSec title="Data Ownership">
            You own your data. Ave merely facilitates encrypted key exchange. We do not access, view, or modify user content.
            <br><br>
            This is why deleting your Ave is permanent and irreversible.
        </LegalSec>
        <LegalSec title="Acceptable Use">
            You may not:
            * Attempt to access other users’ data or devices.
            * Reverse-engineer or interfere with Ave’s systems. (exceptions apply, see Ethical Hacking)
            * Use Ave to impersonate, deceive, or facilitate illegal activities.
            Violation of these terms may result in temporary or permanent suspension.
            <br><br>
            <span class="font-bold">Ethical Hacking:</span>
            We appreciate efforts by users or researchers to identify potential vulnerabilities in Ave's security. If you discover any security issues, we encourage you to promptly and responsibly disclose them to our security team at opsec@lantharos.com. Users conducting ethical hacking or vulnerability testing must:
            * Only test their own accounts or use designated testing accounts without compromising other users.
            * Not engage in activities that could lead to service degradation, data breaches, or unauthorized data access.
            * Comply with all applicable laws and respect our Disclosure Policy.
        </LegalSec>
        <LegalSec title="Limitation of Liability">
            Ave is provided “as is.”
            <br><br>
            We make no guarantees of uninterrupted availability, though we aim for 99.98% monthly uptime.
            <br><br>
            Lantharos is not liable for data loss resulting from user error, loss of devices, or destruction of private keys.
        </LegalSec>
        <LegalSec title="Termination">
            You may delete your Ave at any time.
            <br><br>
            We reserve the right to suspend or delete Identities involved in abuse, fraud, or security risks.
        </LegalSec>
        <LegalSec title="Modifications">
            We may update these Terms periodically. Any changes will be announced within the dashboard before taking effect. Continued use implies acceptance of the updated terms.
        </LegalSec>
        <LegalSec title="How we resolve disputes">
            <span class="font-bold">1. Mediation:</span>
            In the event of a dispute, controversy, or claim arising out of or relating to these Terms or the use of the service, you and Lantharos agree to first attempt to resolve the matter informally through mediation. Mediation will be conducted by a neutral mediator mutually agreed upon by both parties. If the mediation does not result in a resolution within 30 days, the matter may proceed to arbitration.
            <br><br>
            <span class="font-bold">2. Arbitration:</span>
            If mediation fails to resolve the dispute, you agree that any unresolved disputes or claims shall be settled through binding arbitration. The arbitration will be conducted by the German Arbitration Institute and will take place in Munich, Germany, unless both parties agree to conduct it online.
            * The arbitrator’s decision will be final and binding, and judgment on the award rendered by the arbitrator may be entered in any court of competent jurisdiction.
            * Arbitration costs shall be shared equally by both parties, unless otherwise decided by the arbitrator.
            * By agreeing to arbitration, you understand and agree to waive your right to a trial by jury or to participate in a class action lawsuit.
            <br><br>
            <span class="font-bold">3. Exceptions:</span>
            Certain claims, including those relating to injunctive relief or issues that cannot be settled through arbitration due to applicable legal restrictions, may be resolved in a court of law.
        </LegalSec>
    </div>
</div>
