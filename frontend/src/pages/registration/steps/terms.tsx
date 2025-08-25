type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function TermsOfUse({handler,setData}: Props) {
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
                        <h2 className="text-[24px] font-semibold">Terms of Use</h2>
                        <p>Welcome to RAVEN! These Terms of Use ("Terms") govern your access to and use of our services, including our website located at <a href="https://ravenid.dev" className="text-accent underline">https://ravenid.dev</a> (the "Site") and any other services we provide (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Services.</p>
                        <h3 className="text-[20px] font-semibold">1. Use of Services</h3>
                        <p>You may use our Services only in compliance with these Terms and all applicable laws, rules, and regulations. You agree not to use our Services for any unlawful or prohibited purpose.</p>
                        <h3 className="text-[20px] font-semibold">2. Account Registration</h3>
                        <p>To access certain features of our Services, you may need to create an account. You agree to provide accurate and complete information during the registration process and to update such information to keep it accurate and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                        <h3 className="text-[20px] font-semibold">3. Privacy</h3>
                        <p>Your privacy is important to us. Please review our Privacy Policy, which explains how we collect, use, and disclose information about you when you use our Services.</p>
                        <h3 className="text-[20px] font-semibold">4. Intellectual Property</h3>
                        <p>The content and materials available through our Services, including but not limited to text, graphics, logos, images, and software, are the property of RAVEN or its licensors and are protected by copyright and other intellectual property laws. You may not use, reproduce, modify, or distribute any content from our Services without our prior written consent.</p>
                        <h3 className="text-[20px] font-semibold">5. Termination</h3>
                        <p>We may terminate or suspend your access to our Services at any time, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use our Services will immediately cease.</p>
                        <h3 className="text-[20px] font-semibold">6. Disclaimer of Warranties</h3>
                        <p>Our Services are provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that our Services will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
                        <h3 className="text-[20px] font-semibold">7. Limitation of Liability</h3>
                        <p>To the maximum extent permitted by law, RAVEN shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (i) your use or inability to use our Services; (ii) any unauthorized access to or use of our servers and/or any personal information stored therein; (iii) any bugs, viruses, trojan horses, or the like that may be transmitted to or through our Services by any third party; (iv) any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content posted, emailed, transmitted, or otherwise made available through our Services; and/or (v) the defamatory, offensive, or illegal conduct of any third party.</p>
                        <h3 className="text-[20px] font-semibold">8. Changes to Terms</h3>
                        <p>We reserve the right to modify or replace these Terms at any time. If we make material changes to these Terms, we will notify you by posting the updated Terms on our Site and updating the "Last Updated" date at the top of these Terms. Your continued use of our Services after the effective date of the updated Terms constitutes your acceptance of the changes.</p>
                        <h3 className="text-[20px] font-semibold">9. Governing Law</h3>
                        <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which RAVEN is headquartered, without regard to its conflict of law principles.</p>
                        <h3 className="text-[20px] font-semibold">10. Contact Us</h3>
                        <p>If you have any questions about these Terms, please contact us at support@ravn.rs.</p>
                    </div>
                </div>
                <button className="flex h-[50px] w-full py-2 pr-[37px] pl-[13px] justify-center items-center gap-[23px] rounded-[16px] bg-accent text-light font-poppins text-[18px] font-medium leading-[22px] outline-none border-none cursor-pointer transition-colors duration-200 hover:bg-[#a190a1] active:bg-[#635963]" onClick={() => {
                    setData(prevData => ({...prevData, acceptedTerms: true }));
                    handler(9)
                }}>
                    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16 32C20.2435 32 24.3131 30.3143 27.3137 27.3137C30.3143 24.3131 32 20.2435 32 16C32 11.7565 30.3143 7.68687 27.3137 4.68629C24.3131 1.68571 20.2435 0 16 0C11.7565 0 7.68687 1.68571 4.68629 4.68629C1.68571 7.68687 0 11.7565 0 16C0 20.2435 1.68571 24.3131 4.68629 27.3137C7.68687 30.3143 11.7565 32 16 32ZM23.0625 13.0625L15.0625 21.0625C14.475 21.65 13.525 21.65 12.9438 21.0625L8.94375 17.0625C8.35625 16.475 8.35625 15.525 8.94375 14.9438C9.53125 14.3625 10.4813 14.3563 11.0625 14.9438L14 17.8813L20.9375 10.9375C21.525 10.35 22.475 10.35 23.0562 10.9375C23.6375 11.525 23.6437 12.475 23.0562 13.0562L23.0625 13.0625Z" fill="#D8D7D7"/>
                    </svg>
                    <p>I have read it and agree</p>
                </button>
            </div>
        </div>
    )
}

export default TermsOfUse;