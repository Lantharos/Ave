import FancySelect from "../../../components/FancySelect.tsx";
import {useState} from "react";

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
    const [securityQuestions, setSecurityQuestions] = useState<{ q1?: string; q2?: string; q3?: string }>({ q1, q2, q3 });

    return (
        <div className="flex flex-row items-center gap-70 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">Let's answer some security questions</h1>

                <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                    Select three security questions and provide your answers. These will be used to verify your identity if you need to reset your password or log in from a new device.
                </p>
            </div>

            <div className={"flex flex-col items-center gap-5 w-[530px]"}>
                <FancySelect options={questions} placeholder={"Select a question"} value={q1} onChange={setQ1}/>
                <input onInput={(event) => {setSecurityQuestions({q1: event.currentTarget.value, q2: securityQuestions.q2, q3: securityQuestions.q3})}} className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" />
                <FancySelect options={questions} placeholder={"Select a question"} value={q2} onChange={setQ2}/>
                <input onInput={(event) => {setSecurityQuestions({q1: securityQuestions.q1, q2: event.currentTarget.value, q3: securityQuestions.q3})}} className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" />
                <FancySelect options={questions} placeholder={"Select a question"} value={q3} onChange={setQ3}/>
                <input onInput={(event) => {setSecurityQuestions({q1: securityQuestions.q1, q2: securityQuestions.q2, q3: event.currentTarget.value})}} className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" />

                <button className="mt-10 flex h-[60px] w-full py-2 pr-12 pl-[34px] justify-center items-center gap-7 rounded-[24px] bg-accent text-light font-poppins text-[24px] font-medium leading-[22px] outline-none border-none cursor-pointer transition-colors duration-200 hover:bg-[#a190a1] active:bg-[#635963]" onClick={async() => {
                    setData((prevData) => ({ ...prevData, securityQuestions: { q1: {q: q1, value: securityQuestions.q1}, q2: {q: q2, value: securityQuestions.q2}, q3: {q: q3, value: securityQuestions.q3} } }));
                    handler(5);
                }}>
                    <svg width="10" height="18" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.63386 8.36719C10.122 8.85547 10.122 9.64844 9.63386 10.1367L2.13533 17.6367C1.64714 18.125 0.854325 18.125 0.366139 17.6367C-0.122046 17.1484 -0.122046 16.3555 0.366139 15.8672L6.98203 9.25L0.370045 2.63281C-0.118141 2.14453 -0.118141 1.35156 0.370045 0.863281C0.858231 0.375 1.65104 0.375 2.13923 0.863281L9.63777 8.36328L9.63386 8.36719Z" fill="#D8D7D7"/>
                    </svg>
                    <p>Continue</p>
                </button>
            </div>
        </div>
    )
}

export default SecurityQuestions;