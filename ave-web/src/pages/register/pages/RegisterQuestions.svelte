<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: (questions: { questionId: number; answer: string }[]) => void }>();

    const questions = [
        "What was the name of your first pet?",
        "What was the name of your elementary school?",
        "What is your mother's maiden name?",
        "What city were you born in?",
        "What was your childhood nickname?",
        "What is the name of your favorite childhood friend?",
        "What was the make of your first car?",
        "What is your favorite movie?",
        "What is the middle name of your oldest sibling?",
        "In what city did your parents meet?",
        "What was your favorite food as a child?",
        "What was the first concert you attended?",
        "What was the name of your first stuffed animal?",
        "What was the first album you purchased?",
        "What is the name of the street you grew up on?",
        "What was your favorite subject in high school?",
        "What was the first video game you played?",
        "What is your favorite book?",
        "Who was your childhood hero?",
        "What is the name of the hospital where you were born?",
        "What was the first thing you learned to cook?",
    ];

    let selectedQuestions = $state<[number | null, number | null, number | null]>([null, null, null]);
    let answers = $state<[string, string, string]>(["", "", ""]);

    function selectQuestion(index: 0 | 1 | 2, questionId: number) {
        selectedQuestions[index] = questionId;
    }

    function getAvailableQuestions(currentIndex: 0 | 1 | 2): { id: number; label: string }[] {
        return questions
            .map((q, i) => ({ id: i, label: q }))
            .filter((q) => {
                // Allow current selection
                if (selectedQuestions[currentIndex] === q.id) return true;
                // Filter out questions selected in other slots
                return !selectedQuestions.includes(q.id);
            });
    }

    let isValid = $derived(
        selectedQuestions.every((q) => q !== null) &&
        answers.every((a) => a.trim().length > 0)
    );

    function goNext() {
        if (!isValid) return;
        
        const result = selectedQuestions.map((questionId, i) => ({
            questionId: questionId!,
            answer: answers[i].trim(),
        }));
        
        onNext?.(result);
    }
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
            {#each [0, 1, 2] as i}
                <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                    <div class="relative w-full">
                        <select 
                            class="appearance-none w-full text-white focus:outline-none bg-[#111111] px-[20px] py-[15px] rounded-full cursor-pointer pr-10"
                            value={selectedQuestions[i] ?? ""}
                            onchange={(e) => selectQuestion(i as 0 | 1 | 2, parseInt((e.target as HTMLSelectElement).value))}
                        >
                            <option value="" disabled>Select a security question</option>
                            {#each getAvailableQuestions(i as 0 | 1 | 2) as question}
                                <option value={question.id}>{question.label}</option>
                            {/each}
                        </select>
                        <svg class="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" width="20" height="20">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    <input 
                        type="text" 
                        class="w-full bg-[#111111] rounded-full mt-[10px] px-[20px] py-[15px] text-white focus:outline-none" 
                        placeholder="Enter your answer"
                        bind:value={answers[i]}
                        disabled={selectedQuestions[i] === null}
                    />
                </div>
            {/each}

            <Button 
                text="CONTINUE" 
                onclick={() => goNext()} 
                icon="/icons/chevronbk-right-38.svg"
                disabled={!isValid}
            />
        </div>
    </div>
</div>
