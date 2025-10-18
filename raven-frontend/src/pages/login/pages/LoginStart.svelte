<script lang="ts">
    export let loginPage: string;
    import Button from "../../../components/Button.svelte";
</script>

<div class="w-auto h-auto flex flex-col items-center z-10">
    <h1 class="font-black text-[36px] text-[#FFFFFF]/80">WHO'S SIGNING IN</h1>
    <h2 class="font-normal text-[18px] text-[#878787] mt-[10px] mb-[40px]">You can also scan the QR Code if you have the phone app to log in quicker.</h2>

    <div class="flex flex-row justify-between items-center w-full">
        <div class="flex flex-col gap-[20px]">
            <div class="flex flex-col p-[30px] bg-[#171717]/80 rounded-[42px]">
                <input class="px-[15px] py-[10px] bg-[#090909]/50 text-[#FFFFFF] text-[18px] rounded-full focus:outline-none focus:ring-2 focus:ring-[#B9BBBE] focus:border-[#B9BBBE]" type="text" placeholder="Your Handle or ID">
            </div>

            <Button text="CONTINUE" icon="/icons/chevronbk-right-38.svg" onclick={() => loginPage = "methods"}></Button>
        </div>

        <div class="flex flex-col p-[25px] bg-[#171717]/80 rounded-[42px]">
            <img src="/QR%20Code.svg" alt="QR Code" />
        </div>
    </div>
</div>