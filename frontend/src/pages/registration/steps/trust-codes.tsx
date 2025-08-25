import {useEffect, useState} from "react";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function TrustCodes({handler,setData}: Props) {
    const [randomCode, setRandomCode] = useState<string>("PRTA-8W45-AZZA-BBWA");
    const [customCode, setCustomCode] = useState<string>("");

    useEffect(() => {
        // Generate a random trust code in the format XXXX-XXXX-XXXX-XXXX where X is an uppercase letter or number
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) code += "-";
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setRandomCode(code);
    }, []);

    return (
        <div className="flex flex-col items-start gap-20 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">Your Trust Codes</h1>

                <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                    You cannot view these codes again after you make your ID, so <span className={"font-bold"}>you should write them down somewhere.</span>
                </p>
            </div>

            <div className={"flex flex-row items-start gap-50 text-left"}>
                <div className={"flex flex-col items-start gap-5"}>
                    <span className={"text-[24px] text-[#878787]"}>Random Trust Code</span>
                    <div className={"flex flex-row items-center gap-5"}>
                        <span className={"text-accent text-[32px] font-bold w-fit"}>{randomCode}</span>
                        <button id={"copy"} className={"cursor-pointer"} onClick={() => {
                            navigator.clipboard.writeText(randomCode).then(() => {
                                // Clipboard successfully set
                                console.log("Copied!");
                            });
                            // Change icon to a checkmark for 2 seconds
                            const button = document.getElementById("copy");
                            if (button) {
                                button.innerHTML = `<svg width="25" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                     <path fill="#8A7B8A" d="M12.25 25.25C15.4989 25.25 18.6147 23.9594 20.9121 21.6621C23.2094 19.3647 24.5 16.2489 24.5 13C24.5 9.7511 23.2094 6.63526 20.9121 4.33794C18.6147 2.04062 15.4989 0.75 12.25 0.75C9.0011 0.75 5.88526 2.04062 3.58794 4.33794C1.29062 6.63526 0 9.7511 0 13C0 16.2489 1.29062 19.3647 3.58794 21.6621C5.88526 23.9594 9.0011 25.25 12.25 25.25ZM17.6572 10.751L11.5322 16.876C11.0824 17.3258 10.3551 17.3258 9.91006 16.876L6.84756 13.8135C6.39775 13.3637 6.39775 12.6363 6.84756 12.1913C7.29736 11.7463 8.02471 11.7415 8.46973 12.1913L10.7188 14.4403L16.0303 9.12402C16.4801 8.67422 17.2074 8.67422 17.6524 9.12402C18.0975 9.57383 18.1022 10.3012 17.6524 10.7462L17.6572 10.751Z" />
                                                    </svg>
                                                    `;
                                setTimeout(() => {
                                    if (button) {
                                        button.innerHTML = `<svg width="25" height="28" viewBox="0 0 25 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path fill="#8A7B8A" d="M11.375 0H18.1617C18.8563 0 19.5234 0.278906 20.0156 0.771094L23.7289 4.48438C24.2211 4.97656 24.5 5.64375 24.5 6.33828V18.375C24.5 19.8242 23.3242 21 21.875 21H11.375C9.92578 21 8.75 19.8242 8.75 18.375V2.625C8.75 1.17578 9.92578 0 11.375 0ZM2.625 7H7V10.5H3.5V24.5H14V22.75H17.5V25.375C17.5 26.8242 16.3242 28 14.875 28H2.625C1.17578 28 0 26.8242 0 25.375V9.625C0 8.17578 1.17578 7 2.625 7Z" />
                                            </svg>`;
                                    }
                                }, 2000);
                            }
                        }}>
                            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.375 0H18.1617C18.8563 0 19.5234 0.278906 20.0156 0.771094L23.7289 4.48438C24.2211 4.97656 24.5 5.64375 24.5 6.33828V18.375C24.5 19.8242 23.3242 21 21.875 21H11.375C9.92578 21 8.75 19.8242 8.75 18.375V2.625C8.75 1.17578 9.92578 0 11.375 0ZM2.625 7H7V10.5H3.5V24.5H14V22.75H17.5V25.375C17.5 26.8242 16.3242 28 14.875 28H2.625C1.17578 28 0 26.8242 0 25.375V9.625C0 8.17578 1.17578 7 2.625 7Z"
                                      fill="#8A7B8A"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className={"flex flex-col items-start gap-5 w-100"}>
                    <span className={"text-[24px] text-[#878787]"}>Custom Trust Code</span>
                    <input className="flex h-[50px] w-full px-[15px] items-center gap-[10px] rounded-[16px] bg-[rgba(32,32,32,0.70)] outline-none border-none text-light placeholder:text-muted font-poppins text-[18px] font-normal" placeholder="Enter your custom trust code" onInput={(e) => {
                        const value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
                        let formattedValue = '';
                        for (let i = 0; i < value.length; i++) {
                            if (i > 0 && i % 4 === 0) formattedValue += '-';
                            formattedValue += value[i];
                        }

                        e.currentTarget.value = formattedValue;
                        setCustomCode(e.currentTarget.value);
                    }} />

                    <button className="mt-5 flex h-[60px] cursor-pointer w-full py-2 pr-12 pl-[34px] justify-center items-center gap-7 rounded-[24px] bg-accent text-light font-poppins text-[24px] font-medium leading-[22px] outline-none border-none transition-colors duration-200 hover:bg-[#a190a1] active:bg-[#635963]" onClick={async() => {
                        setData((prevData) => ({ ...prevData, trustCodes: { randomCode, customCode } }));
                        handler(5);
                    }}>
                        <svg width="10" height="18" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.63386 8.36719C10.122 8.85547 10.122 9.64844 9.63386 10.1367L2.13533 17.6367C1.64714 18.125 0.854325 18.125 0.366139 17.6367C-0.122046 17.1484 -0.122046 16.3555 0.366139 15.8672L6.98203 9.25L0.370045 2.63281C-0.118141 2.14453 -0.118141 1.35156 0.370045 0.863281C0.858231 0.375 1.65104 0.375 2.13923 0.863281L9.63777 8.36328L9.63386 8.36719Z"
                                  fill="#D8D7D7"/>
                        </svg>
                        <p>Continue</p>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TrustCodes;