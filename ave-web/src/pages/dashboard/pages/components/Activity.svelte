<script lang="ts">
    import Text from "../../../../components/Text.svelte";
    import type { ActivityLogEntry } from "../../../../lib/api";

    interface Props {
        entry: ActivityLogEntry;
    }

    let { entry }: Props = $props();

    // Map severity to color
    function getSeverityColor(severity?: string): string {
        switch (severity) {
            case "danger": return "#BF2626";
            case "warning": return "#FFB400";
            case "info":
            default: return "#32A94C";
        }
    }

    // Format action to human-readable title
    function formatAction(action: string): string {
        const actionMap: Record<string, string> = {
            "login": "Login",
            "login_approved": "Login Approved",
            "login_denied": "Login Denied",
            "login_failed": "Failed Login",
            "logout": "Logout",
            "device_added": "New Device",
            "device_removed": "Device Removed",
            "passkey_added": "Passkey Added",
            "passkey_removed": "Passkey Removed",
            "trust_codes_regenerated": "Trust Codes Regenerated",
            "security_questions_updated": "Security Questions Updated",
            "identity_created": "Identity Created",
            "identity_updated": "Identity Updated",
            "identity_deleted": "Identity Deleted",
            "registration": "Account Created",
        };
        return actionMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }

    // Format date
    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }
</script>

<div class="flex flex-row rounded-[20px] md:rounded-[24px] overflow-hidden">
    <div class="min-h-[80px] md:min-h-[100px] flex-grow max-h-full w-[8px] md:w-[20px] z-10" style="background-color: {getSeverityColor(entry.severity)};"></div>
    <div class="flex flex-col px-3 md:px-[20px] py-3 md:py-[15px] bg-[#171717] rounded-r-[20px] md:rounded-r-[24px] w-full gap-[3px]">
        <Text type="p" size={20} weight="semibold" color="#FFFFFF">{formatAction(entry.action)}</Text>
        <Text type="p" size={14} color="#878787">{formatDate(entry.createdAt)}</Text>
        {#if entry.ipAddress}
            <Text type="p" size={14} color="#878787">IP: {entry.ipAddress}</Text>
        {/if}
        {#if entry.details && Object.keys(entry.details).length > 0}
            <div class="mt-1 md:mt-[5px]">
                {#each Object.entries(entry.details) as [key, value]}
                    <Text type="p" size={12} color="#666666">{key}: {String(value)}</Text>
                {/each}
            </div>
        {/if}
    </div>
</div>
