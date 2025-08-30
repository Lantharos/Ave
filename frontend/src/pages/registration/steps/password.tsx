import {useState, useEffect} from "react";
import FancyInput from "../../../components/Basic/FancyInput.tsx";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Password({handler,setData}: Props) {
    const [password, setPassword] = useState("")
    const [show, setShow] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey) setShow(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.altKey) setShow(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    return (
        <div className="mt-[13%] flex flex-col items-center">
            <h1 className="text-light text-center font-poppins text-[48px] font-normal"> Enter your password </h1>
            <p className="w-[615px] text-[#878787] text-justify font-poppins text-[22px] font-normal leading-[26px]">
                Please enter a strong password to secure your account. This password will be used for logging in and should be kept confidential. Make sure it is not easily guessable.
            </p>

            <div className="flex items-end gap-5 justify-center self-stretch mt-4">
                <FancyInput className="flex h-[50px] w-[420px] px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" type={show ? "text" : "password"} autoComplete="new-password" placeholder="•••••••••••••••••••••" onKeyDown={
                    (e) => {
                        if (e.key === 'Enter') {
                            setData({password: password})
                            handler(3)
                        }
                    }
                } onInput={(input) => {
                    setPassword(input.currentTarget.value)
                }} />

                <div className={"w-[240px]"}>
                    <Button icon={<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.1339 10.8701C17.622 11.3584 17.622 12.1514 17.1339 12.6396L9.63533 20.1396C9.14714 20.6279 8.35433 20.6279 7.86614 20.1396C7.37795 19.6514 7.37795 18.8584 7.86614 18.3701L14.482 11.7529L7.87004 5.13574C7.38186 4.64746 7.38186 3.85449 7.87004 3.36621C8.35823 2.87793 9.15104 2.87793 9.63923 3.36621L17.1378 10.8662L17.1339 10.8701Z" fill="#D8D7D7"/>
                    </svg>} justify={"center"} size={"sm"} children={
                        <p>Continue</p>
                    } onClick={async() => {
                        await new Promise(r => setTimeout(r, 1100));
                        setData((prevState) => ({...prevState, password: password}))
                        handler(3)
                    }} />
                </div>
            </div>

            <p className="w-[615px] text-[#4a4a4a] text-justify font-poppins text-[18px] font-normal leading-[22px] mt-6">
                Hold ALT to reveal your password.
            </p>
        </div>
    )
}

export default Password;