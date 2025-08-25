import {useState} from "react";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Start({handler,setData}: Props) {
    const [name, setName] = useState("")

    return (
        <div className="mt-[13%]">
            <h1 className="text-[#D8D7D7] text-center font-montserratAlt text-[96px] font-[500] leading-none">hello!</h1>

            <div className="flex items-end gap-[20px] justify-center mt-6">
                <input className="h-[50px] px-[15px] w-[390px] flex items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-[#5A5A5A] font-poppins text-[18px] font-normal leading-none placeholder:text-[#5A5A5A] focus:text-[#d3d3d3]" placeholder="What's your full name?" onSubmit={() => {
                    setData({name: name})
                    handler(1)
                }} onInput={(input) => setName(input.currentTarget.value)} />
                <button className="flex h-[50px] px-[13px] pr-[37px] justify-center items-center gap-[23px] rounded-[16px] bg-[#8A7B8A] text-[#D8D7D7] font-poppins text-[18px] font-medium leading-[22px] cursor-pointer transition-colors hover:bg-[#a190a1] active:bg-[#635963] duration-300 border-none" onClick={() => {
                    setData({name: name})
                    handler(1)
                }}>
                    <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.1339 10.8701C17.622 11.3584 17.622 12.1514 17.1339 12.6396L9.63533 20.1396C9.14714 20.6279 8.35433 20.6279 7.86614 20.1396C7.37795 19.6514 7.37795 18.8584 7.86614 18.3701L14.482 11.7529L7.87004 5.13574C7.38186 4.64746 7.38186 3.85449 7.87004 3.36621C8.35823 2.87793 9.15104 2.87793 9.63923 3.36621L17.1378 10.8662L17.1339 10.8701Z" fill="#D8D7D7"/>
                    </svg>
                    <p>Continue</p>
                </button>
            </div>
        </div>
    )
}

export default Start;