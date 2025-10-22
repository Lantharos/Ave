<script>
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Passkey from "./components/Passkey.svelte";

    const passkeys = [
        { id: 1, name: "Device 1", addedOn: "2024-01-01" },
        { id: 2, name: "Device 2", addedOn: "2024-02-15" },
    ]
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">Security</Text>
        <Text type="p" size={20}>Protect your Raven ID and the devices that can access it.</Text>
    </div>

    <div class="flex flex-col gap-[10px]">
        <div class="flex flex-col flex-grow bg-[#171717] p-[40px] rounded-[36px]">
            <Text type="h" size={24} weight="bold">Passkeys</Text>
            <p class="text-[#878787] text-[18px]">Passkeys are unique, highly secure tokens that provide quick and convenient access to your account or services. They act as a trusted key to unlock your account, often used in scenarios such as account recovery or emergency access.</p>
            <div class="flex flex-col gap-[10px] mt-[20px]">
                {#each passkeys as passkey}
                    <Passkey passkey={passkey} />
                {/each}
            </div>
        </div>

        <ActionCard action="ADD A NEW PASSKEY" description="Add a passkey to this device." buttons={[
       { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => {} },
    ]}></ActionCard>
    </div>

    <div class="h-[1px] bg-[#202020] w-full"></div>

    <ActionCard action="SECURITY QUESTIONS" description="Answer security questions to help protect your account." buttons={[
       { icon: "/icons/pencil-56.svg", color: "#FFFFFF", onClick: () => {} },
    ]}></ActionCard>

    <ActionCard action="TRUST CODES" description="Trust Codes help verify your identity." buttons={[
       { icon: "/icons/refresh-56.svg", color: "#FFFFFF", onClick: () => {} },
    ]}></ActionCard>
</div>