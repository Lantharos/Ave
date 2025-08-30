import {Button} from "../../../components/Basic/PrimaryButton.tsx";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function PrivacyPolicy({handler,setData}: Props) {
    return (
        <div className="flex flex-row items-center gap-20 mt-[5%]">
            <div className="flex flex-col items-center justify-center w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">
                    Just some legalese left to cover our butts
                </h1>
            </div>

            <div className={"flex flex-col w-[700px] max-w-full gap-[20px] items-start"}>
                <div className={"flex flex-col w-full h-[500px] gap-2 items-start border border-[#8A7B8A] bg-[#171717] rounded-[16px] overflow-y-scroll scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent"}>
                    <div className="p-6 text-justify text-[16px] leading-[24px] space-y-4 text-[#878787]">
                        <h2 className="text-[24px] font-semibold">Privacy Policy</h2>
                        <p>Your privacy is important to us. It is RAVEN's policy to respect your privacy regarding any information we may collect from you across our website, <a href="https://ravenid.dev" className="text-accent underline">https://ravenid.dev</a>, and other sites we own and operate.</p>
                        <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
                        <p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
                        <p>We don’t share any personally identifying information publicly or with third-parties, except when required to by law.</p>
                        <p>Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies.</p>
                        <p>You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services.</p>
                        <p>Your continued use of our website will be regarded as acceptance of our practices around privacy and personal information. If you have any questions about how we handle user data and personal information, feel free to contact us.</p>
                        <p>This policy is effective as of 1 January 2024.</p>
                    </div>
                </div>

                <div className={"rounded-[64px] w-full"}>
                    <Button icon={
                        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                        </svg>
                    } justify={"between"} size={"md"} children={
                        <p>I have read it and agree</p>
                    } onClick={async() => {
                        await new Promise(r => setTimeout(r, 1100));
                        setData(prevData => ({...prevData, acceptedPrivacy: true }));
                        handler(8)
                    }} />
                </div>
            </div>
        </div>
    )
}

export default PrivacyPolicy;