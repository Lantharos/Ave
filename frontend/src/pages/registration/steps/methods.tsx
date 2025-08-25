import GooeyCheckbox from "../../../components/GooeyCheckbox.tsx";
import {useState} from "react";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Methods({handler,setData}: Props) {
    const [enabledMethods, setEnabledMethods] = useState({ });

    function setMethodEnabled(method: string, enabled: boolean) {
        setEnabledMethods((prev) => ({ ...prev, [method]: enabled }));
    }

    return (
        <div className="flex flex-col items-center gap-5 overflow-y-auto w-full">
            <h1 className="text-light text-center font-poppins text-[48px] font-normal"> Which methods would you like to set up now? </h1>
            <p className="text-[#878787] text-center font-poppins text-[22px] font-normal mt-[-10px] mb-10">You can always enable more later on in your ID settings. MFA is available in your ID settings.</p>

            <div className="w-[1100px] flex flex-col items-center gap-[10px] px-5 relative max-h-[60vh]">
                <div className="inline-flex p-[45px] justify-between items-center gap-10 border border-[#8A7B8A] bg-[rgba(23,23,23,0.80)] w-full rounded-t-[32px]">
                    <div className="flex w-[679px] flex-col items-start gap-[10px]">
                        <h1 className="text-light font-poppins text-[32px] font-medium text-left">Security Questions ❓</h1>
                        <p className="text-[#878787] font-poppins text-[16px] text-left font-normal leading-6 w-full">
                            Choose and answer three security questions. These questions will help verify your identity during account recovery or sensitive operations.
                        </p>
                    </div>

                    <div className="w-[115px] h-[85px] ml-[10%] self-center">
                        <GooeyCheckbox onEnabled={() => setMethodEnabled("security-questions", true)} onDisabled={() => setMethodEnabled("security-questions", false)}></GooeyCheckbox>
                    </div>
                </div>

                <div className="inline-flex p-[45px] justify-between items-center gap-10 border border-[#8A7B8A] bg-[rgba(23,23,23,0.80)] w-full rounded-b-[32px]">
                    <div className="flex w-[679px] flex-col items-start gap-[10px]">
                        <h1 className="text-light font-poppins text-[32px] font-medium text-left">Trust Codes 🔢</h1>
                        <p className="text-[#878787] font-poppins text-[16px] font-normal text-left leading-6 w-full">
                            You will get trust codes which will be useful in verifying you are the owner of the ID:<br />
                            <span className="font-semibold">Random Trust Code:</span> A randomly generated code that you can for verification.<br />
                            <span className="font-semibold">Custom Trust Code:</span> This is essentially a second password and should be unique.<br /><br />
                            You cannot view these codes again after you make your ID.
                        </p>
                    </div>

                    <div className="w-[115px] h-[85px] ml-[10%] self-center">
                        <GooeyCheckbox onEnabled={() => setMethodEnabled("trust-codes", true)} onDisabled={() => setMethodEnabled("trust-codes", false)}></GooeyCheckbox>
                    </div>
                </div>

                <button className="flex h-15 w-[1050px] justify-between px-[10px] items-center gap-[23px] bg-accent text-light font-poppins text-[18px] font-medium cursor-pointer transition-colors duration-200 rounded-[32px] hover:bg-[#a190a1] active:bg-[#635963]" onClick={() => {
                    setData((prevData) => ({ ...prevData, methods: enabledMethods }));
                    handler(4)
                }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                    </svg>
                    <p className="text-light font-poppins text-[18px] font-medium">Im all set!</p>
                    <div></div>
                </button>
            </div>
        </div>
    )
}

export default Methods;