import {useState} from "react";

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
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M12.7648 0.659846L11.0614 2.36313L15.6367 6.93806L17.3401 5.23478C18.22 4.35499 18.22 2.92972 17.3401 2.04992L15.9534 0.659846C15.0736 -0.219949 13.6482 -0.219949 12.7683 0.659846H12.7648ZM10.266 3.15846L2.06216 11.3652C1.69613 11.7312 1.42865 12.1852 1.28084 12.6814L0.0349506 16.9149C-0.0530357 17.2141 0.0279117 17.5343 0.246118 17.7525C0.464324 17.9707 0.784594 18.0516 1.08023 17.9672L5.31413 16.7214C5.81037 16.5736 6.26438 16.3061 6.63041 15.9401L14.8413 7.7334L10.266 3.15846Z"
                                fill="#D8D7D7"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={"flex flex-col w-[700px] max-w-full gap-[20px] items-start"}>
                <div className={"flex flex-col w-full gap-2 items-start"}>
                    <input
                        placeholder={"Your display name"}
                        onInput={(event) => {
                            setProfile(prev => ({...prev, displayName: event.currentTarget.value}))
                        }}
                        className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" />
                    <span className={"ml-[15px] text-[#878787]"}>This is how your name will appear publicly</span>
                </div>
                <input
                    placeholder={"@your_username"}
                    onInput={(event) => {
                        setProfile(prev => ({...prev, username: event.currentTarget.value}))
                    }}
                    className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" />
                <div className="flex flex-col w-full gap-2 items-start">
                  <textarea
                      className="flex h-[150px] w-full px-[15px] py-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal resize-none"
                      placeholder="Tell us a bit about yourself..." maxLength={200}
                      onInput={(event) => {
                          setProfile(prev => ({...prev, bio: event.currentTarget.value}))
                      }}
                  />
                    <span className="ml-[15px] text-[#878787]">
                        Let others know a bit about you in 200 characters or less
                    </span>
                </div>
                <button className="flex h-[50px] w-full py-2 pr-[37px] pl-[13px] justify-center items-center gap-[23px] rounded-[16px] bg-accent text-light font-poppins text-[18px] font-medium leading-[22px] outline-none border-none cursor-pointer transition-colors duration-200 hover:bg-[#a190a1] active:bg-[#635963]" onClick={() => {
                    setData(prevData => ({...prevData, profile}))
                    handler(7)
                }}>
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                    </svg>
                    <p>I'm all set</p>
                </button>
            </div>
        </div>
    )
}

export default Profile;