import RavenLogoMotion from "../../../components/RavenLogo.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";
type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

export default function PasswordLogin({handler, setData}: Props) {
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
                <div className={"flex flex-col items-start justify-center gap-[20px] w-full h-full"}>
                    <h1 className={"text-[24px] font-[400]"}>Log in with Password</h1>
                    {/*<input className="h-[50px] px-[15px] w-full flex items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-[#5A5A5A] font-poppins text-[18px] font-normal leading-none placeholder:text-[#5A5A5A] focus:text-[#d3d3d3]" placeholder="•••••••••••••••••••••" type={"password"} autoComplete={"current-password"} />*/}

                    <FancyInput placeholder="•••••••••••••••••••••" type={"password"} autoComplete={"current-password"} />

                    <Button icon={<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.1339 10.8701C17.622 11.3584 17.622 12.1514 17.1339 12.6396L9.63533 20.1396C9.14714 20.6279 8.35433 20.6279 7.86614 20.1396C7.37795 19.6514 7.37795 18.8584 7.86614 18.3701L14.482 11.7529L7.87004 5.13574C7.38186 4.64746 7.38186 3.85449 7.87004 3.36621C8.35823 2.87793 9.15104 2.87793 9.63923 3.36621L17.1378 10.8662L17.1339 10.8701Z" fill="#D8D7D7"/>
                    </svg>} justify={"between"} size={"md"} children={
                        <p>Next</p>
                    } onClick={async() => {
                        setData((prevState) => ({...prevState, password: (document.querySelector('input') as HTMLInputElement).value}))
                        await new Promise(r => setTimeout(r, 1100));
                        handler(4)
                    }} />
                </div>
            </div>
        </>
    )
}