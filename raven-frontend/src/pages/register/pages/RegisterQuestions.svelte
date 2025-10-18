<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }

    const questions = [
        { label: "What city were you born in?", value: "q_city" },
        { label: "What was the name of your first pet?", value: "q_pet" },
        { label: "What elementary school did you attend?", value: "q_school" },
        { label: "What is your favorite childhood TV show?", value: "q_tvshow" },
        { label: "What was the first video game you played?", value: "q_game" },
        { label: "What was the name of your first stuffed animal?", value: "q_stuffed" },
        { label: "What was the first foreign country you visited?", value: "q_country" },
        { label: "What color was your childhood bedroom?", value: "q_bedroom" },
        { label: "What was your first Minecraft username?", value: "q_mcuser" },
        { label: "What was your Among Us color?", value: "q_amongus" },
        { label: "What Vine do you still quote unironically?", value: "q_vine" },
        { label: "Who was your childhood celebrity crush?", value: "q_crush" },
        { label: "What cursed Wattpad story scarred you?", value: "q_wattpad" },
        { label: "What’s the most embarrassing username you had?", value: "q_username" },
        { label: "Who was your K-pop bias in middle school?", value: "q_kpop" },
        { label: "What was the name of your childhood imaginary friend?", value: "q_imaginary" },
        { label: "Who was your favorite emo band in middle school?", value: "q_emo" },
        { label: "What was the name of your first crush?", value: "q_firstcrush" },
        { label: "What’s the first anime you binge-watched?", value: "q_anime" },
        { label: "Who was your first stan account dedicated to?", value: "q_stan" },
        { label: "Which One Direction member did you “marry” in your head?", value: "q_1d" },
    ];
</script>

<div class="w-full min-h-screen flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-row items-center justify-center gap-[100px] w-full z-10">
        <div class="flex flex-col gap-[10px] w-[60%]">
            <Text type={"hd"} size={36}>LET'S ANSWER SOME SECURITY QUESTIONS</Text>

            <Text type="p" size={24}>
                Select three security questions and provide your answers. These will be used to verify your identity if you need to prove it.
            </Text>
        </div>

        <div class="flex flex-col gap-[10px] w-[40%]">
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <div class="relative w-full">
                    <select class="appearance-none w-full text-white focus:outline-none bg-[#111111] px-[20px] py-[15px] rounded-full cursor-pointer pr-10">
                        <option disabled selected>Select a security question</option>
                        {#each questions as question}
                            <option value={question.value}>{question.label}</option>
                        {/each}
                    </select>
                    <svg class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" width="20" height="20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                <input type="text" class="w-full bg-[#111111] rounded-full mt-[10px] px-[20px] py-[15px] text-white focus:outline-none" placeholder="Enter your answer" />
            </div>
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <div class="relative w-full">
                    <select class="appearance-none w-full text-white focus:outline-none bg-[#111111] px-[20px] py-[15px] rounded-full cursor-pointer pr-10">
                        <option disabled selected>Select a security question</option>
                        {#each questions as question}
                            <option value={question.value}>{question.label}</option>
                        {/each}
                    </select>
                    <svg class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" width="20" height="20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                <input type="text" class="w-full bg-[#111111] rounded-full mt-[10px] px-[20px] py-[15px] text-white focus:outline-none" placeholder="Enter your answer" />
            </div>
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <div class="relative w-full">
                    <select class="appearance-none w-full text-white focus:outline-none bg-[#111111] px-[20px] py-[15px] rounded-full cursor-pointer pr-10">
                        <option disabled selected>Select a security question</option>
                        {#each questions as question}
                            <option value={question.value}>{question.label}</option>
                        {/each}
                    </select>
                    <svg class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" width="20" height="20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                <input type="text" class="w-full bg-[#111111] rounded-full mt-[10px] px-[20px] py-[15px] text-white focus:outline-none" placeholder="Enter your answer" />
            </div>

            <Button text="CONTINUE" onclick={() => onNext()} icon="/icons/chevronbk-right-38.svg" />
        </div>
    </div>
</div>