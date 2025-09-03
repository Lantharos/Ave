import FancySelect from "../../../components/Basic/FancySelect.tsx";
import {useState} from "react";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

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

function SecurityQuestions({handler,setData}: Props) {
    const [q1, setQ1] = useState<string>();
    const [q2, setQ2] = useState<string>();
    const [q3, setQ3] = useState<string>();

    // answers state
    const [answers, setAnswers] = useState<{ q1?: string; q2?: string; q3?: string }>({});

    // individual error messages
    const [errors, setErrors] = useState<{ q1?: string; a1?: string; q2?: string; a2?: string; q3?: string; a3?: string }>({});

    const validate = () => {
        const nextErrors: typeof errors = {};
        if (!q1) nextErrors.q1 = "You need to select a question"; else if (!answers.q1) nextErrors.a1 = "You need to answer this question";
        if (!q2) nextErrors.q2 = "You need to select a question"; else if (!answers.q2) nextErrors.a2 = "You need to answer this question";
        if (!q3) nextErrors.q3 = "You need to select a question"; else if (!answers.q3) nextErrors.a3 = "You need to answer this question";
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const onContinue = async () => {
        if (!validate()) return; // don't proceed if errors
        await new Promise(r => setTimeout(r, 1100));
        setData((prevData) => ({
            ...prevData,
            securityQuestions: {
                q1: { q: q1, value: answers.q1 },
                q2: { q: q2, value: answers.q2 },
                q3: { q: q3, value: answers.q3 }
            }
        }));
        handler(5);
    };

    return (
        <div className="flex flex-row items-center gap-70 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">Let's answer some security questions</h1>

                <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                    Select three security questions and provide your answers. These will be used to verify your identity if you need to reset your password or log in from a new device.
                </p>
            </div>

            <div className={"flex flex-col items-center gap-5 w-[530px]"}>
                <FancySelect
                    options={questions}
                    placeholder={"Select a question"}
                    value={q1}
                    onChange={(v) => { setQ1(v); setErrors(e => ({...e, q1: undefined})); }}
                    error={!!errors.q1}
                    helperText={errors.q1}
                />
                <FancyInput
                    placeholder="Answer"
                    value={answers.q1 || ""}
                    onChange={(e) => { const v = e.currentTarget.value; setAnswers(a => ({...a, q1: v})); if (errors.a1) setErrors(er => ({...er, a1: undefined})); }}
                    error={!!errors.a1}
                    helperText={errors.a1}
                />

                <FancySelect
                    options={questions}
                    placeholder={"Select a question"}
                    value={q2}
                    onChange={(v) => { setQ2(v); setErrors(e => ({...e, q2: undefined})); }}
                    error={!!errors.q2}
                    helperText={errors.q2}
                />
                <FancyInput
                    placeholder="Answer"
                    value={answers.q2 || ""}
                    onChange={(e) => { const v = e.currentTarget.value; setAnswers(a => ({...a, q2: v})); if (errors.a2) setErrors(er => ({...er, a2: undefined})); }}
                    error={!!errors.a2}
                    helperText={errors.a2}
                />

                <FancySelect
                    options={questions}
                    placeholder={"Select a question"}
                    value={q3}
                    onChange={(v) => { setQ3(v); setErrors(e => ({...e, q3: undefined})); }}
                    error={!!errors.q3}
                    helperText={errors.q3}
                />
                <FancyInput
                    placeholder="Answer"
                    value={answers.q3 || ""}
                    onChange={(e) => { const v = e.currentTarget.value; setAnswers(a => ({...a, q3: v})); if (errors.a3) setErrors(er => ({...er, a3: undefined})); }}
                    error={!!errors.a3}
                    helperText={errors.a3}
                    onKeyDown={(e) => { if (e.key === 'Enter') onContinue(); }}
                />

                <div className={"rounded-[64px] w-full"}>
                    <Button icon={
                        <svg width="10" height="18" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.63386 8.36719C10.122 8.85547 10.122 9.64844 9.63386 10.1367L2.13533 17.6367C1.64714 18.125 0.854325 18.125 0.366139 17.6367C-0.122046 17.1484 -0.122046 16.3555 0.366139 15.8672L6.98203 9.25L0.370045 2.63281C-0.118141 2.14453 -0.118141 1.35156 0.370045 0.863281C0.858231 0.375 1.65104 0.375 2.13923 0.863281L9.63777 8.36328L9.63386 8.36719Z" fill="#D8D7D7"/>
                        </svg>
                    } justify={"between"} size={"md"} children={
                        <p>Continue</p>
                    } onClick={onContinue} />
                </div>
            </div>
        </div>
    )
}

export default SecurityQuestions;