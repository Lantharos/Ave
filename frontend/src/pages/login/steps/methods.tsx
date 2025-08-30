import RavenLogoMotion from "../../../components/RavenLogo.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>;
};

export default function SelectLoginMethod({handler, setData, data}: Props) {
    function renderMethods() {
        const methods = [
            {
                value: "Continue with Password",
                key: "password"
            },
            {
                value: "Continue with Passkey",
                key: "passkey"
            },
            {
                value: "Authorize from Primary Device",
                key: "app"
            }
        ];
        // if (data.methods) {
        //     for (const method in data.methods) {
        //         if (data.methods[method] === true) {
        //             methods.push(method);
        //         }
        //     }
        // }
        return methods.map((method, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === methods.length - 1;
            const radiusClass = isFirst && isLast
                ? "rounded-[16px]"
                : isFirst
                    ? "rounded-t-[16px]"
                    : isLast
                        ? "rounded-b-[16px]"
                        : "rounded-none";
            return (
                <div
                    key={method.key}
                    className={`flex flex-row items-center gap-[5px] w-full bg-[#090909]/30 backdrop-blur-[40px] px-[20px] py-[15px] cursor-pointer hover:bg-[#090909]/50 transition-colors ${radiusClass}`}
                    onClick={() => {
                        setData({...data, selectedMethod: method.key});
                        handler(3);
                    }}
                >
                    <h2 className={"text-[20px] font-[500]"}>{method.value}</h2>
                    <svg
                        width="15" height="15"
                        viewBox="0 8 17 10"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="origin-center rotate-[-90deg] mt-[3px] ml-auto"
                    >
                        <path d="M7.75736 13.1929C8.14783 13.5834 8.78196 13.5834 9.17243 13.1929L16.6066 5.75875C16.9971 5.36828 16.9971 4.73415 16.6066 4.34368C16.2161 3.95321 15.582 3.95321 15.1915 4.34368L8.56569 10.9695L1.93987 4.34368C1.5494 3.95321 0.915267 3.95321 0.524799 4.34368C0.134332 4.73415 0.134332 5.36828 0.524799 5.75875L7.75736 13.1929Z" fill="#878787"/>
                    </svg>
                </div>
            );
        });
    }

    return (
        <>
            <div className={"flex flex-col items-start gap-[50px] w-[100%]"}>
                <RavenLogoMotion size={60} onClick={() => window.location.href = "/"}/>
                <div className={"flex flex-col items-start gap-[20px]"}>
                    <h1 className="text-[#D8D7D7] font-montserratAlt text-[48px] font-[500] leading-none">Your Name</h1>
                    <div className="flex flex-row items-center gap-[20px] w-full bg-[#090909]/30 backdrop-blur-[40px] px-[15px] py-[10px] rounded-full">
                        <img src={"/placeholder.svg"} alt={"Profile"} className={"w-[30px] h-[30px] rounded-full object-cover"} />
                        <p className="text-[#878787] font-poppins text-[20px] font-normal">your_username</p>
                        <svg
                            width="15" height="15"
                            viewBox="0 8 17 10"            // cropped to the path’s bbox (rounded)
                            preserveAspectRatio="xMidYMid meet"
                            className="origin-center rotate-90 cursor-pointer hover:opacity-70 transition-opacity"
                            xmlns="http://www.w3.org/2000/svg"
                            onClick={() => handler(1)}
                        >
                            <path d="M7.75736 17.1929C8.14783 17.5834 8.78196 17.5834 9.17243 17.1929L16.6066 9.75875C16.9971 9.36828 16.9971 8.73415 16.6066 8.34368C16.2161 7.95321 15.582 7.95321 15.1915 8.34368L8.56569 14.9695L1.93987 8.34368C1.5494 7.95321 0.915267 7.95321 0.524799 8.34368C0.134332 8.73415 0.134332 9.36828 0.524799 9.75875L7.75736 17.1929Z" fill="#878787"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div className="w-[2px] bg-[#3a3a3a] mx-[40px]" />
            <div className={"flex flex-col items-start justify-end gap-[25px] ml-[10px] w-full h-full"}>
                <h1 className={"text-[24px] font-[500]"}>Select how you'd like to log in</h1>
                <div className={"flex flex-col items-start gap-[10px] w-full"}>
                    {renderMethods()}
                </div>
            </div>
        </>
    )
}