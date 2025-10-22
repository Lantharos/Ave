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
        <Text type="h" size={48} weight="bold">My Data</Text>
    </div>

    <ActionCard action="DOWNLOAD MY DATA" description="This package includes only metadata tied to your Raven ID. App-level data must be exported from those apps directly." buttons={[
       { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => {} },
    ]}></ActionCard>

    <ActionCard color="#E14747" action="DELETE MY DATA" description="Deleting your ID permanently erases all encrypted data and breaks access for apps using this identity. This action cannot be undone." buttons={[
       { icon: "/icons/chevron-right-68.svg", color: "#E14747", onClick: () => {} },
    ]}></ActionCard>

    <Text type="p" size={16} color="#878787" cclass="self-center">Raven is designed to minimize stored data. What little exists is encrypted end-to-end and visible only to you.</Text>
</div>