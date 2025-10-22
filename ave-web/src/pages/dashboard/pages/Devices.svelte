<script>
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Device from "./components/Device.svelte";

    const devices = [
        { id: 1, hostname: "Niko's S23", ip: "100.123.128.109", location: "Belgrade, Serbia", type: "phone", primary: true },
        { id: 2, hostname: "Work Laptop", ip: "100.123.128.109", location: "Belgrade, Serbia", type: "computer", primary: false },
        { id: 3, hostname: "iPad Pro", ip: "100.123.128.109", location: "Belgrade, Serbia", type: "tablet", primary: false },
        { id: 4, hostname: "Home PC", ip: "100.123.128.109", location: "Belgrade, Serbia", type: "computer", primary: false },
    ];
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">Devices</Text>
        <Text type="p" size={20}>Here are all the devices currently logged in to your ID.</Text>
    </div>

    <ActionCard action="ADD A NEW DEVICE" description="You can easily enroll a new device by generating a QR code that you can scan with your phone or tablet. This action will require you to present your passkey. " buttons={[
       { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => {} },
    ]}></ActionCard>

    <ActionCard color="#FFB400" action="REVOKE ALL DEVICES" description="This will invalidate keys on all enrolled devices, except this one, you will need to re-add every device again." buttons={[
       { icon: "/icons/chevron-right-68.svg", color: "#FFB400", onClick: () => {} },
    ]}></ActionCard>

    <div class="grid grid-cols-4 gap-[20px]">
        {#each devices as device}
            {#if ["phone", "computer", "tablet"].includes(device.type)}
                <Device device={device} />
            {/if}
        {/each}
    </div>
</div>