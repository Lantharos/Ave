<script>
    import Text from "../../../components/Text.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Activity from "./components/Activity.svelte";

    const passkeys = [
        { id: 1, name: "Device 1", addedOn: "2024-01-01" },
        { id: 2, name: "Device 2", addedOn: "2024-02-15" },
    ]
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">Activity Log</Text>
    </div>

    <div class="flex flex-row w-full gap-[10px]">
        <button class="px-[30px] py-[15px] bg-[#171717] rounded-full flex items-center justify-center text-[#D3D3D3] text-[16px] hover:bg-[#1E1E1E] transition-colors duration-300 cursor-pointer">
            Filter
        </button>

        <input type="text" placeholder="Search activity..." class="flex-grow px-[30px] py-[15px] bg-[#171717] rounded-full text-[#D3D3D3] text-[16px] focus:outline-none focus:bg-[#1E1E1E] transition-colors duration-300" />
    </div>

    <div class="flex flex-col gap-[15px] w-full">
        <Activity bannerColor="#32A94C" title="New Device" date="March 10, 2024 at 2:45 PM" location="New York, USA"/>
        <Activity bannerColor="#BF2626" title="Failed Enrollment" />
        <Activity bannerColor="#FFB400" title="MFA Updated" />
    </div>
</div>