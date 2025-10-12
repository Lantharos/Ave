export default function MyID() {
    return (
        <div className={"bg-[#111111]/60 backdrop-blur-[40px] rounded-[64px] p-[50px] w-full h-fit flex flex-col gap-[40px]"}>
            <h1 className={"font-poppins text-[#D8D7D7] text-[36px] font-[600]"}>My ID</h1>

            <div className={"flex flex-col w-[80%] rounded-[32px] overflow-clip"}>
                <div className={"bg-[#8A7B8A] w-full h-[100px] rounded-t-[32px]"}></div>
                <div className={"flex flex-col gap-[ bg-[#171717]/80 w-full rounded-b-[32px]"}>
                    <img src={"/placeholder.svg"} alt={"Avatar"} className={"w-[128px] h-[128px] rounded-[32px] border-[6px] border-[#111111] mt-[-64px] ml-[32px]"} />
                    <div className={"flex flex-col gap-[8px] mt-[16px] mx-[32px] mb-[32px] bg-[#111111] p-[30px] rounded-[24px]"}>
                        <div className={"flex flex-row justify-between items-center"}>
                            <div className={"flex flex-col gap-[4px]"}>
                                <span className={"text-[#878787] font-poppins font-[800]"}>FULL NAME</span>
                                <span className={"text-[#D8D7D7] font-poppins text-[24px] font-[600]"}>Niko Arden</span>
                            </div>
                            <button className={"bg-[#202020]/70 hover:bg-[#2B2B2B] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[15px] rounded-[18px]"}>
                                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.6831 3.10816L14.7904 5.0007L19.8741 10.084L21.7668 8.19142C22.7444 7.21387 22.7444 5.63024 21.7668 4.65269L20.226 3.10816C19.2484 2.13061 17.6647 2.13061 16.687 3.10816H16.6831ZM13.9067 5.8844L4.79128 15.003C4.38459 15.4096 4.08739 15.9141 3.92315 16.4654L2.53883 21.1694C2.44107 21.5017 2.53101 21.8576 2.77346 22.1C3.01592 22.3424 3.37177 22.4324 3.70025 22.3385L8.40459 20.9543C8.95597 20.7901 9.46043 20.4929 9.86712 20.0862L18.9903 10.9677L13.9067 5.8844Z" fill="#D8D7D7"/>
                                </svg>
                            </button>
                        </div>
                        <div className={"flex flex-row justify-between items-center mt-[16px]"}>
                            <div className={"flex flex-col gap-[4px]"}>
                                <span className={"text-[#878787] font-poppins font-[800]"}>USERNAME</span>
                                <span className={"text-[#D8D7D7] font-poppins text-[24px] font-[600]"}>arden</span>
                            </div>
                            <button className={"bg-[#202020]/70 hover:bg-[#2B2B2B] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[15px] rounded-[18px]"}>
                                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.6831 3.10816L14.7904 5.0007L19.8741 10.084L21.7668 8.19142C22.7444 7.21387 22.7444 5.63024 21.7668 4.65269L20.226 3.10816C19.2484 2.13061 17.6647 2.13061 16.687 3.10816H16.6831ZM13.9067 5.8844L4.79128 15.003C4.38459 15.4096 4.08739 15.9141 3.92315 16.4654L2.53883 21.1694C2.44107 21.5017 2.53101 21.8576 2.77346 22.1C3.01592 22.3424 3.37177 22.4324 3.70025 22.3385L8.40459 20.9543C8.95597 20.7901 9.46043 20.4929 9.86712 20.0862L18.9903 10.9677L13.9067 5.8844Z" fill="#D8D7D7"/>
                                </svg>
                            </button>
                        </div>
                        <div className={"flex flex-row justify-between items-center mt-[16px]"}>
                            <div className={"flex flex-col gap-[4px]"}>
                                <span className={"text-[#878787] font-poppins font-[800]"}>EMAIL</span>
                                <span className={"text-[#D8D7D7] font-poppins text-[24px] font-[600]"}>arden@lanth.me</span>
                            </div>
                            <button className={"bg-[#202020]/70 hover:bg-[#2B2B2B] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[15px] rounded-[18px]"}>
                                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.6831 3.10816L14.7904 5.0007L19.8741 10.084L21.7668 8.19142C22.7444 7.21387 22.7444 5.63024 21.7668 4.65269L20.226 3.10816C19.2484 2.13061 17.6647 2.13061 16.687 3.10816H16.6831ZM13.9067 5.8844L4.79128 15.003C4.38459 15.4096 4.08739 15.9141 3.92315 16.4654L2.53883 21.1694C2.44107 21.5017 2.53101 21.8576 2.77346 22.1C3.01592 22.3424 3.37177 22.4324 3.70025 22.3385L8.40459 20.9543C8.95597 20.7901 9.46043 20.4929 9.86712 20.0862L18.9903 10.9677L13.9067 5.8844Z" fill="#D8D7D7"/>
                                </svg>
                            </button>
                        </div>
                        <div className={"flex flex-row justify-between items-center mt-[16px]"}>
                            <div className={"flex flex-col gap-[4px]"}>
                                <span className={"text-[#878787] font-poppins font-[800]"}>BIRTHDAY</span>
                                <span className={"text-[#D8D7D7] font-poppins text-[24px] font-[600]"}>April 30th, 2009</span>
                            </div>
                            <button className={"bg-[#202020]/70 hover:bg-[#2B2B2B] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[15px] rounded-[18px]"}>
                                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.6831 3.10816L14.7904 5.0007L19.8741 10.084L21.7668 8.19142C22.7444 7.21387 22.7444 5.63024 21.7668 4.65269L20.226 3.10816C19.2484 2.13061 17.6647 2.13061 16.687 3.10816H16.6831ZM13.9067 5.8844L4.79128 15.003C4.38459 15.4096 4.08739 15.9141 3.92315 16.4654L2.53883 21.1694C2.44107 21.5017 2.53101 21.8576 2.77346 22.1C3.01592 22.3424 3.37177 22.4324 3.70025 22.3385L8.40459 20.9543C8.95597 20.7901 9.46043 20.4929 9.86712 20.0862L18.9903 10.9677L13.9067 5.8844Z" fill="#D8D7D7"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={"flex flex-col gap-[10px]"}>
                <span className={"text-[#878787] font-poppins font-[800]"}>PASSWORD</span>
                <button className={"border-[#32A94C] border-[2px] hover:bg-[#32A94C] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[10px] rounded-full w-fit"}>
                    Change Password
                </button>
            </div>

            <div className={"flex flex-col gap-[10px]"}>
                <span className={"text-[#878787] font-poppins font-[800]"}>DATA DELETION</span>
                <span className={"text-[#878787] font-poppins"}>When you choose to delete your ID, it entails the removal of all data associated with your account, It's important to note that deleting your ID results in the loss of all data associated with apps that utilize RAVEN for it’s identity system.</span>
                <button className={"border-[#BF2626] border-[2px] hover:bg-[#BF2626] transition-colors duration-300 cursor-pointer text-[#d3d3d3] font-poppins font-[600] px-[20px] py-[10px] rounded-full w-fit"}>
                    Delete my Data
                </button>
            </div>
        </div>
    )
}