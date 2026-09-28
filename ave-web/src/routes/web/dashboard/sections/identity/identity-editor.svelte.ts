import { api } from "$lib/surfaces/web/lib/api";
import { createStoredIdentityEncryptionKeyPair, loadMasterKey } from "$lib/surfaces/web/lib/crypto";
import { auth } from "$lib/surfaces/web/stores/auth";
import type { Identity as IdentityType } from "$lib/surfaces/web/lib/api";

export function createIdentityEditor(getIdentity: () => IdentityType | null) {
    let displayName = $state("");
    let handle = $state("");
    let email = $state("");
    let verificationCode = $state("");
    let birthday = $state("");
    let avatarUrl = $state("");

    let editing = $state({
        displayName: false,
        handle: false,
        email: false,
        birthday: false
    });

    let isSaving = $state(false);
    let error = $state("");
    let success = $state("");
    let showEmailVerificationModal = $state(false);
    let lastSyncedIdentityId = $state<string | null>(null);

    $effect(() => {
        const identity = getIdentity();
        if (identity) {
            const switchedIdentity = lastSyncedIdentityId !== identity.id;
            if (switchedIdentity) {
                lastSyncedIdentityId = identity.id;
                verificationCode = "";
                showEmailVerificationModal = false;
            }
            displayName = identity.displayName;
            handle = identity.handle;
            email = identity.pendingEmail || identity.email || "";
            birthday = identity.birthday || "";
            avatarUrl = identity.avatarUrl || "";
        } else {
            lastSyncedIdentityId = null;
            showEmailVerificationModal = false;
        }
    });

    async function saveField(field: string) {
        const identity = getIdentity();
        if (!identity) return;

        isSaving = true;
        error = "";
        success = "";

        try {
            const updateData: Record<string, string | null> = {};

            switch (field) {
                case "displayName":
                    updateData.displayName = displayName;
                    break;
                case "handle":
                    updateData.handle = handle;
                    break;
                case "birthday":
                    updateData.birthday = birthday || null;
                    break;
            }

            const { identity: updated } = await api.identities.update(identity.id, updateData);
            auth.updateIdentity(updated);
            editing[field as keyof typeof editing] = false;
            success = "Saved!";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to save";
        } finally {
            isSaving = false;
        }
    }

    async function startEmailVerification() {
        const identity = getIdentity();
        if (!identity || !email.trim()) return;

        isSaving = true;
        error = "";
        success = "";

        try {
            const { identity: updated } = await api.identities.startEmailVerification(identity.id, email.trim());
            auth.updateIdentity(updated);
            email = updated.pendingEmail || updated.email || "";
            editing.email = false;
            verificationCode = "";
            showEmailVerificationModal = true;
            success = "Verification code sent";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to send verification code";
        } finally {
            isSaving = false;
        }
    }

    async function verifyEmail() {
        const identity = getIdentity();
        if (!identity || !verificationCode.trim()) return;

        isSaving = true;
        error = "";
        success = "";

        try {
            const { identity: updated } = await api.identities.verifyEmail(identity.id, verificationCode.trim());
            auth.updateIdentity(updated);
            email = updated.email || "";
            verificationCode = "";
            showEmailVerificationModal = false;
            success = "Email verified";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to verify email";
        } finally {
            isSaving = false;
        }
    }

    async function resendEmailVerification() {
        const identity = getIdentity();
        if (!identity) return;

        isSaving = true;
        error = "";
        success = "";

        try {
            const { identity: updated } = await api.identities.resendEmailVerification(identity.id);
            auth.updateIdentity(updated);
            email = updated.pendingEmail || updated.email || "";
            showEmailVerificationModal = true;
            success = "Verification code sent";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to resend verification code";
        } finally {
            isSaving = false;
        }
    }

    async function clearEmail() {
        const identity = getIdentity();
        if (!identity) return;

        isSaving = true;
        error = "";
        success = "";

        try {
            const { identity: updated } = await api.identities.clearEmail(identity.id);
            auth.updateIdentity(updated);
            email = "";
            verificationCode = "";
            editing.email = false;
            showEmailVerificationModal = false;
            success = "Email removed";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to remove email";
        } finally {
            isSaving = false;
        }
    }

    async function createIdentity() {
        if (!displayName.trim() || !handle.trim()) {
            error = "Name and handle are required";
            return;
        }

        isSaving = true;
        error = "";

        try {
            const masterKey = await loadMasterKey();
            const { identity: created } = await api.identities.create({
                displayName: displayName.trim(),
                handle: handle.trim().toLowerCase(),
                email: email.trim() || undefined,
                birthday: birthday || undefined,
                avatarUrl: avatarUrl || undefined,
                encryptionKey: masterKey ? await createStoredIdentityEncryptionKeyPair(masterKey) : undefined,
            });

            auth.addIdentity(created);
            success = "Identity created!";

            displayName = "";
            handle = "";
            email = "";
            birthday = "";
            avatarUrl = "";
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to create identity";
        } finally {
            isSaving = false;
        }
    }

    function formatBirthday(dateStr: string): string {
        if (!dateStr) return "Not set";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    async function handleAvatarUpload(file: File) {
        const identity = getIdentity();
        if (!identity) {
            avatarUrl = URL.createObjectURL(file);
            return;
        }

        try {
            error = "";
            const { avatarUrl: uploadedAvatarUrl } = await api.upload.avatar(identity.id, file);
            auth.updateIdentity({ ...identity, avatarUrl: uploadedAvatarUrl });

            success = "Avatar updated!";
            setTimeout(() => success = "", 2000);
        } catch (e) {
            console.error("[Avatar Upload] Failed:", e);
            error = e instanceof Error ? e.message : "Failed to upload avatar";
        }
    }

    let showDeleteConfirm = $state(false);
    let isDeleting = $state(false);
    const emailActionButtonClass = "w-12 h-12 md:w-[122px] md:h-[122px] shrink-0 p-3 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 rounded-[16px] md:rounded-[32px] flex items-center justify-center";
    let displayedEmail = $derived(getIdentity()?.pendingEmail || getIdentity()?.email || "Not set");
    let emailIsPending = $derived(Boolean(getIdentity()?.pendingEmail));

    async function deleteIdentity() {
        const identity = getIdentity();
        if (!identity) return;

        isDeleting = true;
        error = "";

        try {
            await api.identities.delete(identity.id);
            auth.removeIdentity(identity.id);
            showDeleteConfirm = false;

        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to delete identity";
        } finally {
            isDeleting = false;
        }
    }

    return {
        get error() { return error; },
        get success() { return success; },
        get avatarUrl() { return avatarUrl; },
        handleAvatarUpload,
        get displayName() { return displayName; },
        set displayName(value: typeof displayName) { displayName = value; },
        get handle() { return handle; },
        set handle(value: typeof handle) { handle = value; },
        get email() { return email; },
        set email(value: typeof email) { email = value; },
        get birthday() { return birthday; },
        set birthday(value: typeof birthday) { birthday = value; },
        get isSaving() { return isSaving; },
        createIdentity,
        get editing() { return editing; },
        saveField,
        startEmailVerification,
        get displayedEmail() { return displayedEmail; },
        get emailIsPending() { return emailIsPending; },
        get showEmailVerificationModal() { return showEmailVerificationModal; },
        set showEmailVerificationModal(value: typeof showEmailVerificationModal) { showEmailVerificationModal = value; },
        get emailActionButtonClass() { return emailActionButtonClass; },
        formatBirthday,
        get showDeleteConfirm() { return showDeleteConfirm; },
        set showDeleteConfirm(value: typeof showDeleteConfirm) { showDeleteConfirm = value; },
        deleteIdentity,
        get isDeleting() { return isDeleting; },
        get verificationCode() { return verificationCode; },
        set verificationCode(value: typeof verificationCode) { verificationCode = value; },
        verifyEmail,
        resendEmailVerification,
        clearEmail,
    };
}
