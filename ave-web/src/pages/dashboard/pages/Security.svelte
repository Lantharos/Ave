<script>
    import Text from "../../../components/Text.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";

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
                    <div class="flex flex-row gap-[10px] w-full">
                        <div class="flex flex-col justify-center items-start px-[20px] py-[15px] bg-[#111111] rounded-[24px] flex-grow">
                            <Text type="h" size={20} color="#B9BBBE" weight="bold">{passkey.name}</Text>
                        </div>
                        <button aria-label="delete" class="flex flex-row justify-center items-center px-[20px] py-[15px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] min-h-full w-fit">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 11V17M14 11V17M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M3 6H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
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