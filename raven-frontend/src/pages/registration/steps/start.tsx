import {useState} from "react";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Start({handler,setData}: Props) {
    const [name, setName] = useState("")
    const [error, setError] = useState("")

    return (
        <div className="mt-[13%]">
            <h1 className="text-[#D8D7D7] text-center font-montserratAlt text-[96px] font-[500] leading-none">hello!</h1>

            <div className="flex items-start gap-[20px] justify-center mt-6">
                <FancyInput error={(error != "")} helperText={error} placeholder={"What's your full name?"} type={"text"} autoComplete={"name"} onInput={(input) => setName(input.currentTarget.value)} />

                <div className={"w-[250px]"}>
                    <Button icon={<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.1339 10.8701C17.622 11.3584 17.622 12.1514 17.1339 12.6396L9.63533 20.1396C9.14714 20.6279 8.35433 20.6279 7.86614 20.1396C7.37795 19.6514 7.37795 18.8584 7.86614 18.3701L14.482 11.7529L7.87004 5.13574C7.38186 4.64746 7.38186 3.85449 7.87004 3.36621C8.35823 2.87793 9.15104 2.87793 9.63923 3.36621L17.1378 10.8662L17.1339 10.8701Z" fill="#D8D7D7"/>
                    </svg>} justify={"center"} size={"sm"} children={
                        <p>Continue</p>
                    } onClick={async() => {
                        if (name.length < 1) {
                            setError("Name cannot be empty")
                            return;
                        }
                        setError("")
                        await new Promise(r => setTimeout(r, 1100));
                        setData({name: name})
                        handler(2)
                    }} />
                </div>
            </div>
        </div>
    )
}

export default Start;