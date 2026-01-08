<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Spinner from "../../../components/Spinner.svelte";
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-col items-start justify-center gap-[100px] w-[70%] z-10">
        <div class="flex flex-col gap-[100px]">
            <div class="flex flex-col gap-[10px]">
                <Text type={"hd"} size={36}>
                    FINISHING UP!
                </Text>

                <Text type="p" size={24}>
                    Ave will now generate your encryption keys and finish setup. This may take a few moments. Please ensure you stay connected to the internet during this process.
                </Text>
            </div>

            <Spinner size={100} />
        </div>
    </div>
</div>