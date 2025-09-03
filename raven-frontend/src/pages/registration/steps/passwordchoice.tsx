import {Button} from "../../../components/Basic/PrimaryButton.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

// @Deprecated passwordless cannot be selected at registration now as there is criteria to meet so users dont get locked out
function PasswordChoice({handler,setData}: Props) {
    return (
        <div className="flex flex-col items-center gap-5 pt-[60px]">
            <h1 className="text-light text-center font-poppins text-[48px] font-normal leading-[0]"> Would you like to have a password? </h1>

            <div className="w-[1091px] h-[465px] z-10 mt-10 flex flex-col items-center gap-[10px] px-5 relative">
                <div className="flex p-[45px] justify-between items-center rounded-t-[32px] border border-[#8A7B8A] bg-[rgba(23,23,23,0.80)] w-full">
                    <div className="flex w-[679px] flex-col items-start gap-[10px] leading-none p-[20px]">
                        <h1 className="text-light font-poppins text-[32px] font-medium text-left leading-[0]">Passwordless 🔒</h1>
                        <p className="text-[#878787] font-poppins text-[16px] font-normal leading-7 text-left mt-8">
                            You can log in with a passkey or use your primary device and biometric methods to log in without a password. This method enhances security and convenience by leveraging modern authentication techniques.
                        </p>
                    </div>

                    <div className={"w-auto h-[85px] ml-[10%] self-center"}>
                        <Button icon={<svg width="30" height="31" viewBox="0 0 30 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clipPath="url(#clip0_3200_39)">
                                <path d="M15 30.2319C18.9782 30.2319 22.7936 28.6515 25.6066 25.8385C28.4196 23.0254 30 19.2101 30 15.2319C30 11.2536 28.4196 7.43832 25.6066 4.62527C22.7936 1.81223 18.9782 0.231873 15 0.231873C11.0218 0.231873 7.20644 1.81223 4.3934 4.62527C1.58035 7.43832 0 11.2536 0 15.2319C0 19.2101 1.58035 23.0254 4.3934 25.8385C7.20644 28.6515 11.0218 30.2319 15 30.2319ZM21.6211 12.478L14.1211 19.978C13.5703 20.5287 12.6797 20.5287 12.1348 19.978L8.38477 16.228C7.83398 15.6772 7.83398 14.7866 8.38477 14.2416C8.93555 13.6967 9.82617 13.6909 10.3711 14.2416L13.125 16.9955L19.6289 10.4858C20.1797 9.935 21.0703 9.935 21.6152 10.4858C22.1602 11.0366 22.166 11.9272 21.6152 12.4721L21.6211 12.478Z" fill="#D8D7D7"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3200_39">
                                    <rect width="30" height="30" fill="white" transform="translate(0 0.231873)"/>
                                </clipPath>
                            </defs>
                        </svg>} justify={"center"} size={"lg"} customMiddleGap={30} children={
                            <p>Select</p>
                        } onClick={async() => {
                            await new Promise(r => setTimeout(r, 1100));
                            setData((prevData) => ({ ...prevData, passwordless: true }));
                            handler(3)
                        }} />
                    </div>
                </div>

                <div className="flex p-[45px] justify-between items-center rounded-b-[32px] border border-[#8A7B8A] bg-[rgba(23,23,23,0.80)] w-full">
                    <div className="flex w-[679px] flex-col items-start gap-[10px] leading-none p-[20px]">
                        <h1 className="text-light font-poppins text-[32px] font-medium text-left leading-[0]">Password 🔑</h1>
                        <p className="text-[#878787] font-poppins text-[16px] font-normal leading-7 text-left mt-8">
                            Create a strong password to secure your account. This is a traditional and reliable method of protecting your ID. Make sure to store this password safely, and don’t share it with others.
                        </p>
                    </div>

                    <div className={"w-auto h-[85px] ml-[10%] self-center"}>
                        <Button icon={<svg width="30" height="31" viewBox="0 0 30 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clipPath="url(#clip0_3200_39)">
                                <path d="M15 30.2319C18.9782 30.2319 22.7936 28.6515 25.6066 25.8385C28.4196 23.0254 30 19.2101 30 15.2319C30 11.2536 28.4196 7.43832 25.6066 4.62527C22.7936 1.81223 18.9782 0.231873 15 0.231873C11.0218 0.231873 7.20644 1.81223 4.3934 4.62527C1.58035 7.43832 0 11.2536 0 15.2319C0 19.2101 1.58035 23.0254 4.3934 25.8385C7.20644 28.6515 11.0218 30.2319 15 30.2319ZM21.6211 12.478L14.1211 19.978C13.5703 20.5287 12.6797 20.5287 12.1348 19.978L8.38477 16.228C7.83398 15.6772 7.83398 14.7866 8.38477 14.2416C8.93555 13.6967 9.82617 13.6909 10.3711 14.2416L13.125 16.9955L19.6289 10.4858C20.1797 9.935 21.0703 9.935 21.6152 10.4858C22.1602 11.0366 22.166 11.9272 21.6152 12.4721L21.6211 12.478Z" fill="#D8D7D7"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3200_39">
                                    <rect width="30" height="30" fill="white" transform="translate(0 0.231873)"/>
                                </clipPath>
                            </defs>
                        </svg>} justify={"center"} size={"lg"} customMiddleGap={30} children={
                            <p>Select</p>
                        } onClick={async() => {
                            await new Promise(r => setTimeout(r, 1100));
                            setData((prevData) => ({ ...prevData, passwordless: false }));
                            handler(2)
                        }} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PasswordChoice;