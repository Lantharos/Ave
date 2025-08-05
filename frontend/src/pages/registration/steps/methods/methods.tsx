import "./methods.css"
import GooeyCheckbox from "../../../../components/checkbox/GooeyCheckbox.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Methods({handler,setData}: Props) {
    return (
        <div className={"starter3"}>
            <h1 className={"ph1"}> Which methods would you like to set up now? </h1>
            <p className={"paph1"}>
                You can always enable more later on in your ID settings. MFA is available in your ID settings.
            </p>

            <div className={"choices"}>
                <div className="choice start">
                    <div className="choice-details">
                        <h1>Security Questions ❓</h1>
                        <p className={"choice-description"}>
                            Choose and answer three security questions. These questions will help verify your identity during account recovery or sensitive operations.
                        </p>
                    </div>

                    <div style={{width: "115px", height: "85px", marginLeft: "10%", alignSelf: "center"}}>
                        <GooeyCheckbox></GooeyCheckbox>
                    </div>
                </div>

                <div className="choice">
                    <div className="choice-details">
                        <h1>Trust Codes 🔢</h1>
                        <p className={"choice-description"}>
                            You will get trust codes which will be useful in verifying you are the owner of the ID:
                            <br />
                            <span style={{fontWeight:600}}>Random Trust Code:</span> A randomly generated code that you can for verification.
                            <br />
                            <span style={{fontWeight:600}}>Custom Trust Code:</span> This is essentially a second password and should be unique.
                            <br /><br />
                            You cannot view these codes again after you make your ID.
                        </p>
                    </div>

                    <div style={{width: "115px", height: "85px", marginLeft: "10%", alignSelf: "center"}}>
                        <GooeyCheckbox></GooeyCheckbox>
                    </div>
                </div>

                <div className="choice">
                    <div className="choice-details">
                        <h1>Voice ID 🔊</h1>
                        <p className={"choice-description"}>
                            Record your voice to create a voiceprint. This biometric method uses your unique voice patterns to verify your identity during login and other secure actions.
                        </p>
                    </div>

                    <div style={{width: "115px", height: "85px", marginLeft: "10%", alignSelf: "center"}}>
                        <GooeyCheckbox></GooeyCheckbox>
                    </div>
                </div>

                <div className="choice">
                    <div className="choice-details">
                        <h1>Face ID 🙂</h1>
                        <p className={"choice-description"}>
                            Set up facial recognition using your device's camera. This biometric method uses your unique facial features to secure your account.
                        </p>
                    </div>

                    <div style={{width: "115px", height: "85px", marginLeft: "10%", alignSelf: "center"}}>
                        <GooeyCheckbox></GooeyCheckbox>
                    </div>
                </div>

                <div className="choice end">
                    <div className="choice-details">
                        <h1>Primary Device 📲</h1>
                        <p className={"choice-description"}>
                            Designate a primary device for managing your account security and approving new logins. This device will be your main point of control for account access and recovery. You can switch the primary device only to a phone for security reasons.
                        </p>
                    </div>

                    <div style={{width: "115px", height: "85px", marginLeft: "10%", alignSelf: "center"}}>
                        <GooeyCheckbox></GooeyCheckbox>
                    </div>
                </div>

                <button className={"continue-methods"} onClick={() => {
                    setData({password: password})
                    handler(3)
                }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                    </svg>
                    <p className={"papa2"}>Im all set!</p>
                    <div></div>
                </button>

                <div className={"blank-space"}>
                </div>
            </div>
        </div>
    )
}

export default Methods;