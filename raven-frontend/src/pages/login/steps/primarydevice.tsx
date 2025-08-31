import RavenLogoMotion from "../../../components/RavenLogo.tsx";
import {useEffect} from "react";
type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
};

export default function PrimaryDeviceLogin({handler, setData, data}: Props) {
    useEffect(() => {
        // placeholder for actual logic to check for notification confirmation
        const timer = setTimeout(() => {
            setData({...data, primaryDeviceConfirmed: true});
            handler(6); // proceed to the next step after 5 seconds
        }, 5000);
        return () => clearTimeout(timer);
    }, [data, handler, setData]);

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
                    <p className={"text-[#878787] font-poppins text-[18px]"}>We have sent you a notification to your device. Please check it and when asked confirm the login.</p>
                </div>
            </div>
        </>
    )
}