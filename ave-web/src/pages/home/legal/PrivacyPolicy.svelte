<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import LegalSec from "./components/LegalSec.svelte";
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed flex flex-col">
    <img src="/grads/privacy_grad.png" alt="gradient" class="absolute top-0 left-0 w-full h-auto pointer-events-none select-none" />
    <div class="self-center mt-[100px]">
        <Text type="h" size={96} weight="bold">Your data matters!</Text>
        <Text type="p" size={36} weight="medium" cclass="self-center text-center">Here's how we protect it</Text>
    </div>

    <div class="w-[60%] self-center flex flex-col gap-[80px] mt-[120px] mb-[100px]">
        <LegalSec title="Introduction">
            Ave is designed to protect your privacy by default. We don’t sell your data, track your behavior, or store personal information beyond what’s strictly necessary for identity verification and cryptographic key management.
            <br><br>
            For any questions regarding your data, please contact our acting Data Protection Officer at data@lantharos.com
        </LegalSec>
        <LegalSec title="What We Collect">
            Ave is built around <span class="italic">minimal data processing</span>. We only process:
               * Cryptographic identifiers (like your UUID or key fingerprints) to verify your identity.
               * Device metadata to link trusted devices.
               * Recovery data, such as hashed trust codes or encrypted answers to security questions.
            <br><br>
            We do <span class="font-black">NOT</span> collect:
               * IP addresses for tracking
               * Location data
               * Biometric data
               * Device activity logs
        </LegalSec>
        <LegalSec title="How Your Data Is Stored">
            All personal data remains encrypted on your device or within distributed encrypted storage.
            <br><br>
            We cannot read, decrypt, or modify your private information. Ave functions as an identity layer, not a database of user data.
            <br><br>
            Encryption uses:
            * End-to-end cryptography (E2EE) between devices.
            * Optional passkeys stored securely via platform-specific keychains (e.g., Secure Enclave, TPM, or Android Keystore).
        </LegalSec>
        <LegalSec title="How We Use Your Data">
            Ave only uses your data to:
            1. Authenticate your identity between devices.
            2. Enable apps and services to recognize your Ave Identity.
            3. Facilitate key exchange, verification, and encryption.
            We do not use your data for advertising, analytics, profiling, or resale.
        </LegalSec>
        <LegalSec title="Data Sharing">
            Ave never shares your data with third parties except when:
            * You explicitly grant an app permission to access identity fields (e.g., your handle, avatar, or display name).
            * Required by law or valid court order, and only if technically possible (encrypted data is inaccessible to us).
        </LegalSec>
        <LegalSec title="You have rights!">
            If you’re in the EU, UK, or other regions with privacy laws, you have the right to:
            * Access what data Ave holds about you.
            * Delete your Ave at any time (erases encrypted data irreversibly).
            * Withdraw consent for third-party app connections.
            * Port your Ave data using the provided export tools.
            * You may request not to be subject to decisions based solely on automated processing.
            Requests can be made through your account dashboard or at data@lantharos.com.
        </LegalSec>
        <LegalSec title="Data Retention">
            We retain encrypted metadata only as long as necessary to maintain your active Ave.
            <br><br>
            Deleted Aves are permanently destroyed, with no recovery option.
        </LegalSec>
        <LegalSec title="Security">
            All communications between your devices and Ave’s verification endpoints are protected with modern cryptography (TLS 1.3, Ed25519, AES-GCM, Kyber, Dilithium). 
            <br><br>
            Ave’s architecture is designed so no employee or third party can impersonate or decrypt your identity.
        </LegalSec>
        <LegalSec title="International Compliance">
            Ave complies with:
            * GDPR (EU/EEA)
            * UK GDPR & Data Protection Act 2018
            * CCPA / CPRA (California)
            * PIPEDA (Canada)
            * LGPD (Brazil)
        </LegalSec>
    </div>
</div>