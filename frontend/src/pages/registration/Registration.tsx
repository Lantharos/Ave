import "./Registration.css"
import logo from "../../assets/raven logo.svg"
import {useState} from "react";
import Start from "./steps/start/start.tsx";
import PasswordChoice from "./steps/passwordchoice/passwordchoice.tsx";
import Password from "./steps/password/password.tsx";

export default function Registration() {
    const [step, setStep] = useState(0);
    const [data, setData] = useState({ });

    function returnStepComponent() {
        console.log(data)

        switch (step) {
            case 0:
                return <Start handler={setStep} setData={setData} />
            case 1:
                return <PasswordChoice handler={setStep} setData={setData} />
            case 2:
                return <Password handler={setStep} setData={setData} />
            default:
                return <Start handler={setStep} setData={setData} />
        }
    }

    return (
        <>
            <div className={"topbar"}>
                <img src={logo} alt="raven logo" className={"logo"} onClick={() => {window.location.href = "/"}}/>

                <div className={"progress-bar"}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="198" height="4" viewBox="0 0 198 4" fill="none">
                        <path d="M2 0C0.89543 0 0 0.89543 0 2C0 3.10457 0.89543 4 2 4V0ZM2 4H198V0H2V4Z" fill={step == 0 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" stroke-width="4" stroke={step == 1 || step == 2 || step == 3 || step == 4 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" stroke-width="4" stroke={step == 5 || step == 6 || step == 7 || step == 8 || step == 9 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" stroke-width="4" stroke={step == 10 || step == 11 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" stroke-width="4" stroke={step == 12 || step == 13 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                </div>
            </div>

            <div className={"content"}>
                {returnStepComponent()}
            </div>

            <div className={"footer"}></div>
        </>
    )
}