<script lang="ts">
    import Text from "../../../../components/Text.svelte";

    export let bannerColor: string = "#32A94C";
    export let title: string = "New Login";
    export let date: string = "March 10, 2024 at 2:45 PM";
    export let location: string = "New York, USA";
</script>

<div class="flex flex-row rounded-[24px] overflow-hidden">
    <div class="min-h-[100px] flex-grow max-h-full w-[20px] z-10" style="background-color: {bannerColor};"></div>
    <div class="flex flex-col px-[20px] py-[15px] bg-[#171717] rounded-r-[24px] w-full gap-[3px]">
        <Text type="p" size={20} weight="semibold" color="#FFFFFF">{title}</Text>
        <Text type="p" size={14} color="#878787">{date}</Text>
        <Text type="p" size={14} color="#878787">Location: {location}</Text>
    </div>
</div>