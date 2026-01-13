<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Spinner from "../../../components/Spinner.svelte";
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
    <div class="flex flex-col items-center md:items-start justify-center gap-8 md:gap-[100px] w-full md:w-[70%] z-10">
        <div class="flex flex-col gap-8 md:gap-[100px] items-center md:items-start">
            <div class="flex flex-col gap-4 md:gap-[10px] text-center md:text-left">
                <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">
                    FINISHING UP!
                </h2>

                <p class="font-normal text-[#878787] text-base md:text-[24px]">
                    Ave will now generate your encryption keys and finish setup. This may take a few moments. Please ensure you stay connected to the internet during this process.
                </p>
            </div>

            <Spinner size={100} />
        </div>
    </div>
</div>