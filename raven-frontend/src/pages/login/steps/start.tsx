import RavenLogoMotion from "../../../components/RavenLogo.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";
type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

export default function StartLogin({handler, setData}: Props) {
    return (
        <>
            <div className={"flex flex-col items-start gap-[50px] w-[100%]"}>
                <RavenLogoMotion size={60} onClick={() => window.location.href = "/"}/>
                <div className={"flex flex-col items-start gap-[20px]"}>
                    <h1 className="text-[#D8D7D7] font-montserratAlt text-[48px] font-[500] leading-none">log in</h1>
                    <p className="text-[#878787] font-poppins text-[20px] font-normal">to continue to RAVEN.</p>
                </div>
            </div>
            <div className="w-[2px] bg-[#3a3a3a] mx-[40px]" />
            <div className={"flex flex-col items-center gap-[50px] ml-[10px] w-full h-full"}>
                <div className={"flex flex-col items-start justify-center gap-[20px] w-full h-full"}>
                    <label className="ml-[15px] text-[#878787] font-poppins text-[20px] font-normal leading-none">username</label>
                    <FancyInput placeholder={"your_username"} type={"text"} autoComplete={"username"} />

                    <Button icon={<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.1339 10.8701C17.622 11.3584 17.622 12.1514 17.1339 12.6396L9.63533 20.1396C9.14714 20.6279 8.35433 20.6279 7.86614 20.1396C7.37795 19.6514 7.37795 18.8584 7.86614 18.3701L14.482 11.7529L7.87004 5.13574C7.38186 4.64746 7.38186 3.85449 7.87004 3.36621C8.35823 2.87793 9.15104 2.87793 9.63923 3.36621L17.1378 10.8662L17.1339 10.8701Z" fill="#D8D7D7"/>
                    </svg>} justify={"between"} size={"md"} children={
                        <p>Next</p>
                    } onClick={async() => {
                        setData({username: (document.querySelector('input') as HTMLInputElement).value})
                        await new Promise(r => setTimeout(r, 1100));
                        handler(2)
                    }} />
                </div>

                <div className={"absolute bottom-[50px] flex flex-col items-center gap-[10px]"}>
                    <p className="text-[#4a4a4a] font-poppins text-[16px] font-normal">Don't have an ID? <a href="/register" className="text-[#8A7B8A] hover:underline">Create one.</a></p>
                </div>
            </div>
        </>
    )
}