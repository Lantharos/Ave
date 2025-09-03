import {useState} from "react";
import {FancyTextarea} from "../../../components/Basic/FancyTextarea.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Profile({handler,setData}: Props) {
    const [profile, setProfile] = useState({
        avatar: null,
        displayName: "",
        username: "",
        bio: ""
    })

    return (
        <div className="flex flex-row items-start gap-20 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">
                    So, which persona will you use?
                </h1>

                <p className="text-[#878787] text-justify text-[19.85px] leading-[26px] space-y-4">
                    Fill out your profile just the way you want it, you can change any of this in your ID settings after you finish making your ID{" "}
                    <span className="text-[14px]">(just make sure its not hateful)</span>
                </p>

                <div className="relative self-end">
                    <img src={"/placeholder.svg"} alt={"Profile"} className="w-[150px] max-w-full rounded-[16px]"/>
                    <button className="bg-[#202020] hover:bg-[#404040] transition-colors duration-300 rounded-[12px] p-[10px] absolute bottom-2 right-2 cursor-pointer">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 1V13M10 1L15 6M10 1L5 6M19 13V17C19 17.5304 18.7893 18.0391 18.4142 18.4142C18.0391 18.7893 17.5304 19 17 19H3C2.46957 19 1.96086 18.7893 1.58579 18.4142C1.21071 18.0391 1 17.5304 1 17L1 13" stroke="#D8D7D7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div className={"flex flex-col w-[700px] max-w-full gap-[20px] items-start"}>
                <div className={"flex flex-col w-full gap-2 items-start"}>
                    <FancyInput
                        placeholder={"Your display name"}
                        type={"text"}
                        onChange={(event) => {
                            const value = event.currentTarget.value;
                            setProfile(prev => ({...prev, displayName: value}))
                        }}
                        helperText={"This is how your name will appear publicly"}
                    />
                </div>

                <FancyInput
                    placeholder={"@your_username"}
                    type={"text"}
                    onChange={(event) => {
                        const value = event.currentTarget.value;
                        setProfile(prev => ({...prev, username: value}))
                    }}
                />

                <div className="flex flex-col w-full gap-2 items-start">
                    <FancyTextarea
                        placeholder="Tell us a bit about yourself..."
                        value={profile.bio}
                        onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                        maxLength={200}
                        helperText={"Let others know a bit about you in 200 characters or less"}
                    />
                </div>

                <div className={"rounded-[64px] w-full"}>
                    <Button icon={
                        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                        </svg>
                    } justify={"between"} size={"md"} children={
                        <p>I'm all set</p>
                    } onClick={async() => {
                        await new Promise(r => setTimeout(r, 1100));
                        setData(prevData => ({...prevData, profile}))
                        handler(7)
                    }} />
                </div>
            </div>
        </div>
    )
}

export default Profile;