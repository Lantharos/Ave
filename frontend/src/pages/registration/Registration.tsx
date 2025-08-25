import logo from "../../assets/raven logo.svg"
import {useState, useRef, useEffect} from "react";
import Start from "./steps/start.tsx";
import PasswordChoice from "./steps/passwordchoice.tsx";
import Password from "./steps/password.tsx";
import Methods from "./steps/methods.tsx";
import Passkey from "./steps/passkey.tsx";
import SecurityQuestions from "./steps/security-questions.tsx";
import TrustCodes from "./steps/trust-codes.tsx";
import Profile from "./steps/profile.tsx";
import PrivacyPolicy from "./steps/privacy.tsx";
import TermsOfUse from "./steps/terms.tsx";

export default function Registration() {
    const [step, setStep] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<Record<string, any>>({});
    const [contentOverflowing, setContentOverflowing] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    function returnStepComponent() {
        switch (step) {
            case 0:
                return <Start handler={setStep} setData={setData} />
            case 1:
                return <PasswordChoice handler={setStep} setData={setData} />
            case 2:
                return <Password handler={setStep} setData={setData} />
            case 3:
                return <Methods handler={setStep} setData={setData} />
            case 4:
                return <Passkey handler={setStep} setData={setData} />
            case 5:
                if (data.methods?.["security-questions"] === true && !data.securityQuestions) {
                    return <SecurityQuestions handler={setStep} setData={setData} />
                } else if (data.methods?.["trust-codes"] === true && !data.trustCodes) {
                    return <TrustCodes handler={setStep} setData={setData} />
                } else {
                    setStep(6);
                    return <Start handler={setStep} setData={setData} />
                }
            case 6:
                return <Profile handler={setStep} setData={setData} />
            case 7:
                return <PrivacyPolicy handler={setStep} setData={setData} />
            case 8:
                return <TermsOfUse handler={setStep} setData={setData} />
            case 9:
                // Final step - show summary or success message
                return (
                    <div className="mt-[13%]">
                        <h1 className="text-[#D8D7D7] text-center font-montserratAlt text-[96px] font-[500] leading-none">All set!</h1>
                        <p className="text-[#878787] text-center font-poppins text-[22px] font-normal mt-6">Your ID has been created successfully. You can now log in using your chosen methods.</p>
                    </div>
                );
            default:
                return <Start handler={setStep} setData={setData} />
        }
    }

    // Recalculate on step change & resize
    useEffect(() => {
        function check() {
            if (!containerRef.current) return;
            // If scroll height exceeds client height we have overflow
            const el = containerRef.current;
            setContentOverflowing(el.scrollHeight > el.clientHeight + 5); // +5 tolerance
        }
        check();
        const r = () => requestAnimationFrame(check);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, [step]);

    return (
        <div ref={containerRef} className="min-h-screen flex flex-col w-full relative">
            <div className="flex justify-between items-start w-full relative top-0 left-0 right-0">
                <img src={logo} alt="raven logo" className="m-[15px] cursor-pointer" onClick={() => {window.location.href = "/"}}/>
                <div className="absolute left-1/2 -translate-x-1/2 mt-[10px] flex w-[1000px] h-[10px] items-center gap-[5px] shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="198" height="4" viewBox="0 0 198 4" fill="none">
                        <path d="M2 0C0.89543 0 0 0.89543 0 2C0 3.10457 0.89543 4 2 4V0ZM2 4H198V0H2V4Z" fill={step == 0 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 1 || step == 2 || step == 3 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 4 || step == 5 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 6 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 7 || step == 8 || step == 9 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                </div>
            </div>
            <div className="flex flex-col justify-center items-center text-center z-10 h-auto relative px-4 w-screen">
                {returnStepComponent()}
            </div>
            <div className={(contentOverflowing ? "mt-[100px]" : "mt-auto") + " w-screen h-[250px] font-poppins shrink-0"} style={{background: "linear-gradient(180deg, #090909 10%, rgba(41,37,41,0.83) 100%)"}}></div>
        </div>
    )
}