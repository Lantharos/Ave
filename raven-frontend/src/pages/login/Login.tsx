import {useState} from "react";
import StartLogin from "./steps/start.tsx";
import SelectLoginMethod from "./steps/methods.tsx";
import Aurora from "../../components/Backgrounds/Aurora.tsx";
import PasswordLogin from "./steps/password.tsx";
import PasskeyLogin from "./steps/passkey.tsx";
import MFALogin from "./steps/2fa.tsx";
import PrimaryDeviceLogin from "./steps/primarydevice.tsx";
import TOTPLogin from "./steps/authenticator.tsx";

export default function Login() {
    const [step, setStep] = useState(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<Record<string, any>>({});

    function returnStepComponent() {
        switch (step) {
            case 1:
                return <StartLogin handler={setStep} setData={setData} />
            case 2:
                return <SelectLoginMethod handler={setStep} setData={setData} data={data} />
            case 3:
                if (data.selectedMethod === "password") {
                    return <PasswordLogin handler={setStep} setData={setData} />
                } else if (data.selectedMethod === "passkey") {
                    return <PasskeyLogin handler={setStep} setData={setData} />
                } else if (data.selectedMethod === "app") {
                    return <PrimaryDeviceLogin handler={setStep} setData={setData} data={data} />
                }

                return <StartLogin handler={setStep} setData={setData} />
            case 4:
                if (data.selectedMethod === "password") {
                    // TODO make sure to check if 2FA is enabled, and if only one is available immediately skip to it
                    return <MFALogin handler={setStep} setData={setData} data={data} />
                }

                return <StartLogin handler={setStep} setData={setData} />
            case 5:
                if (data.selectedMFAMethod === "app") {
                    return <PrimaryDeviceLogin handler={setStep} setData={setData} data={data} />
                } else if (data.selectedMFAMethod === "totp") {
                    return <TOTPLogin handler={setStep} setData={setData} />
                }

                return <StartLogin handler={setStep} setData={setData} />
            default:
                return <div />
        }
    }

    // function returnBG() {
    //     switch (step) {
    //         case 1:
    //             return <img src={"/login_bgs/1.svg"} alt={"Background"} className={"fixed"}/>
    //         case 2:
    //             return <img src={"/login_bgs/2.svg"} alt={"Background"} className={"fixed bottom-0 left-0 w-full h-auto"} />
    //         default:
    //             return <img src={"/login_bgs/3.svg"} alt={"Background"} className={"fixed bottom-0 left-0 w-full h-auto"} />
    //     }
    // }

    return (
        <>
            {/*{returnBG()}*/}
            <div className={"fixed bottom-0 left-0 w-full h-[800px] rotate-180"}>
                <Aurora colorStops={["#419a7e", "#6859a5", "#4caa40"]} blend={0.5} amplitude={1.0} speed={0.5}/>
            </div>
            <div className={"absolute flex flex-row ml-[10%] mt-[10%] w-[55%] p-[50px] h-[500px] rounded-[48px] bg-[#111111]/50 backdrop-blur-[40px]"}>
                {returnStepComponent()}
            </div>
        </>
    )
}