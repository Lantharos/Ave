import {type Dispatch, useState} from "react";
import MyID from "./pages/MyID.tsx";

function SidebarButton(text: string, page: string, setPage: Dispatch<React.SetStateAction<string>>) {
    const active = text === page
    const onclick = () => {
        setPage(text)
    }

    return (
        <button className={`flex flex-row items-start leading-none w-max-full font-poppins rounded-[20px] px-[20px] py-[18px] text-[18px] font-[500] ${active ? "bg-[#B4A6B5]/20 text-[#A8A8A8]" : "hover:bg-[#202020]/70 duration-300 transition-colors cursor-pointer text-[#878787]"}`} onClick={onclick}>
            {text}
        </button>
    )
}

export default function Dashboard() {
    const [page, setPage] = useState("My ID")

    function getPageComponent() {
        switch (page) {
            case "My ID":
                return <MyID />
        }
    }

    return (
        <div className={"bg-[#090909] flex flex-row px-[120px] py-[100px] gap-[100px]"}>
            {/*sidebar*/}
            <div className={"flex flex-col items-start w-[20%] font-poppins"}>
                <div className={"flex flex-col gap-[3px] w-full"}>
                    <span className={"text-[#878787] font-poppins font-[800]"}>USER SETTINGS</span>
                    {SidebarButton("My ID", page, setPage)}
                    {SidebarButton("Profile", page, setPage)}
                    {SidebarButton("Security",page, setPage)}
                    {SidebarButton("Activity Log", page, setPage)}
                    {SidebarButton("Privacy & Safety", page, setPage)}
                    {SidebarButton("Installed Apps", page, setPage)}
                    {SidebarButton("Devices", page, setPage)}
                </div>
                <hr className={"border-[#202020] w-full my-[20px]"} />
                <div className={"flex flex-col gap-[3px] w-full"}>
                    <span className={"text-[#878787] font-poppins font-[800]"}>FRIENDS</span>
                    {SidebarButton("Your Friends", page, setPage)}
                    {SidebarButton("Add Friends", page, setPage)}
                    {SidebarButton("Blocked",page, setPage)}
                </div>
                <hr className={"border-[#202020] w-full my-[20px]"} />
                <div className={"flex flex-col gap-[3px] w-full"}>
                    <span className={"text-[#878787] font-poppins font-[800]"}>BILLING</span>
                    {SidebarButton("Payment Info", page, setPage)}
                    {SidebarButton("Subscriptions", page, setPage)}
                    {SidebarButton("Gifts",page, setPage)}
                </div>
                <hr className={"border-[#202020] w-full my-[20px]"} />
                <div className={"flex flex-col gap-[3px] w-full"}>
                    {SidebarButton("What's New", page, setPage)}
                    {SidebarButton("Asterisk", page, setPage)}
                </div>
                <hr className={"border-[#202020] w-full my-[20px]"} />
                <div className={"flex flex-col gap-[3px] w-full"}>
                    {SidebarButton("Logout",page, setPage)}
                </div>
            </div>

            {/*main content*/}
            <div className={"flex flex-col w-[80%] text-[#878787] font-poppins z-10"}>
                {getPageComponent()}
            </div>

            <img src={"/dashboard/pulsar_top_dashboard.png"} alt={"Pulsar Top"} className={"absolute top-0 right-0 pointer-events-none select-none"} />
            <img src={"/dashboard/pulsar_bottom_dashboard.png"} alt={"Pulsar Bottom"} className={"absolute top-0 left-0 pointer-events-none select-none"} />
        </div>
    )
}