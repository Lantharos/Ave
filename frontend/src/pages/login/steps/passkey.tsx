import RavenLogoMotion from "../../../components/RavenLogo.tsx";
import {useEffect} from "react";
type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

export default function PasskeyLogin({handler, setData}: Props) {
    useEffect(() => {
        // Prompt the browser to use a passkey for authentication
        (async () => {
            try {
                const assertion = await navigator.credentials.get({
                    publicKey: {
                        challenge: new Uint8Array([ // Dummy challenge, replace with server-provided challenge
                            0x8C, 0xFA, 0x2B, 0x7E, 0x45, 0x6D, 0x3A, 0x1F,
                            0x9B, 0x4C, 0xD2, 0xE3, 0x5A, 0x7F, 0x8E, 0x1A
                        ]).buffer,
                        timeout: 60000,
                        rpId: window.location.hostname,
                        userVerification: 'preferred',
                    }
                });

                if (assertion) {
                    // Here you would normally send the assertion to your server for verification
                    console.log("Passkey authentication successful:", assertion);
                    // Simulate successful login and proceed to next step
                    setData((prev) => ({...prev, passkey: true}));
                    handler(4); // Assuming step 4 is the next step after passkey
                } else {
                    console.error("No assertion returned from passkey authentication.");
                }
            } catch (error) {
                console.error("Passkey authentication failed:", error);
            }
        })();
    }, []);

    return (
        <>
            <div className={"flex flex-col items-start gap-[50px] w-[100%]"}>
                <RavenLogoMotion size={60} onClick={() => window.location.href = "/"}/>
                <div className={"flex flex-col items-start gap-[20px]"}>
                    <h1 className="text-[#D8D7D7] font-montserratAlt text-[48px] font-[500] leading-none">welcome</h1>
                    <div className="flex flex-row items-center gap-[20px] w-full bg-[#090909]/30 backdrop-blur-[40px] px-[15px] py-[10px] rounded-full">
                        <img src={"/placeholder.svg"} alt={"Profile"} className={"w-[30px] h-[30px] rounded-full object-cover"} />
                        <p className="text-[#878787] font-poppins text-[20px] font-normal">your_username</p>
                        <svg
                            width="15" height="15"
                            viewBox="0 8 17 10"            // cropped to the path’s bbox (rounded)
                            preserveAspectRatio="xMidYMid meet"
                            className="origin-center rotate-90 cursor-pointer hover:opacity-70 transition-opacity"
                            xmlns="http://www.w3.org/2000/svg"
                            onClick={() => handler(2)}
                        >
                            <path d="M7.75736 17.1929C8.14783 17.5834 8.78196 17.5834 9.17243 17.1929L16.6066 9.75875C16.9971 9.36828 16.9971 8.73415 16.6066 8.34368C16.2161 7.95321 15.582 7.95321 15.1915 8.34368L8.56569 14.9695L1.93987 8.34368C1.5494 7.95321 0.915267 7.95321 0.524799 8.34368C0.134332 8.73415 0.134332 9.36828 0.524799 9.75875L7.75736 17.1929Z" fill="#878787"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div className="w-[2px] bg-[#3a3a3a] mx-[40px]" />
            <div className={"flex flex-col items-center gap-[50px] ml-[10px] w-full h-full"}>
                <div className={"flex flex-col items-start justify-center gap-[10px] w-full h-full"}>
                    <h1 className={"text-[24px] font-[400]"}>Waiting...</h1>
                    <p className={"text-[#878787] font-poppins text-[18px]"}>Follow the prompts on your device to log in.</p>
                </div>
            </div>
        </>
    )
}