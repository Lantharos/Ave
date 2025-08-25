type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function Passkey({handler,setData}: Props) {
    return (
        <div className="flex flex-row items-center gap-70 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">We’re going to set up your passkey now</h1>

                <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                    <span>
                        A passkey is a secure and convenient way to access your RAVEN account without needing a traditional password. It uses advanced cryptographic techniques to ensure that only you can access your account.
                    </span>

                    <br /><br />

                    <span>
                        Setting up a passkey enhances your security by reducing the risk of password-related threats, such as phishing and password theft.
                    </span>

                    <br /><br />

                    <span className="block font-bold"> To set up your passkey: </span>
                    <span className="block leading-3"> 1. Click the "Set Up Passkey" button below. </span>
                    <span className="block leading-3"> 2. Follow the prompts on your device to complete the setup. </span>
                    <span className="block leading-3"> 3. Ensure your device is secure and only accessible by you. </span>
                </p>
            </div>

            <button className="mt-10 flex h-[70px] py-2 pr-12 pl-[34px] justify-center items-center gap-7 rounded-[24px] bg-accent text-light font-poppins text-[24px] font-medium leading-[22px] outline-none border-none cursor-pointer transition-colors duration-200 hover:bg-[#a190a1] active:bg-[#635963]" onClick={() => {
                try {
                    // Step 1. Create a random challenge (in real apps, your server generates this)
                    // const challenge = new Uint8Array(32);
                    // window.crypto.getRandomValues(challenge);
                    //
                    // // Step 2. Define the options for navigator.credentials.create
                    // const publicKey: PublicKeyCredentialCreationOptions = {
                    //     challenge,
                    //     rp: {
                    //         name: "RAVEN",
                    //         id: window.location.hostname,
                    //     },
                    //     user: {
                    //         id: new TextEncoder().encode("user-id-123"), // Replace with your actual user ID (binary)
                    //         name: "user@example.com",
                    //         displayName: "User Example",
                    //     },
                    //     pubKeyCredParams: [
                    //         { type: "public-key", alg: -7 }, // ES256
                    //         { type: "public-key", alg: -257 }, // RS256
                    //     ],
                    //     authenticatorSelection: {
                    //         userVerification: "preferred",
                    //     },
                    //     timeout: 60000,
                    //     attestation: "none",
                    // };
                    //
                    // // Step 3. Ask the browser to create a credential
                    // const credential = (await navigator.credentials.create({
                    //     publicKey,
                    // })) as PublicKeyCredential;
                    //
                    // // Step 4. Extract data you want to keep (example: rawId, type, response)
                    // const attestationResponse = credential.response as AuthenticatorAttestationResponse;
                    // const clientDataJSON = btoa(
                    //     String.fromCharCode(...new Uint8Array(attestationResponse.clientDataJSON))
                    // );
                    // const attestationObject = btoa(
                    //     String.fromCharCode(...new Uint8Array(attestationResponse.attestationObject))
                    // );
                    //
                    // // Step 5. Save to your state
                    // setData((prevData) => ({
                    //     ...prevData,
                    //     credential: {
                    //         id: credential.id,
                    //         rawId: btoa(
                    //             String.fromCharCode(...new Uint8Array(credential.rawId))
                    //         ),
                    //         type: credential.type,
                    //         clientDataJSON,
                    //         attestationObject,
                    //     },
                    // }));

                    setData((prevData) => ({ ...prevData, passkeySetup: true }));

                    handler(5);
                } catch (err) {
                    console.error("Error creating passkey:", err);
                }
            }}>
                <svg width="32" height="26" viewBox="0 0 32 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.4882 0.199951C13.2293 0.199951 14.899 0.874366 16.1301 2.07483C17.3613 3.2753 18.0529 4.90348 18.0529 6.60119C18.0529 8.29891 17.3613 9.92709 16.1301 11.1276C14.899 12.328 13.2293 13.0024 11.4882 13.0024C9.74714 13.0024 8.07739 12.328 6.84627 11.1276C5.61515 9.92709 4.92352 8.29891 4.92352 6.60119C4.92352 4.90348 5.61515 3.2753 6.84627 2.07483C8.07739 0.874366 9.74714 0.199951 11.4882 0.199951ZM9.14441 15.4029H13.832C14.4372 15.4029 15.0321 15.4629 15.6014 15.5679C15.4937 16.4931 15.9809 17.3483 16.7194 17.8084C15.8681 18.3385 15.3501 19.3887 15.6937 20.4739C15.8989 21.119 16.1758 21.7491 16.5348 22.3543C16.8938 22.9594 17.3144 23.5095 17.7862 24.0046C18.5914 24.8497 19.8172 24.9248 20.7198 24.4397V24.4847C20.7198 24.9448 20.8583 25.4098 21.125 25.7999H1.52321C0.682112 25.8049 0 25.1398 0 24.3196C0 19.3937 4.09267 15.4029 9.14441 15.4029ZM22.361 11.1121C22.361 10.762 22.5918 10.4469 22.9405 10.3719C23.479 10.2519 24.0432 10.1869 24.6176 10.1869C25.192 10.1869 25.7562 10.2519 26.2947 10.3719C26.6434 10.4469 26.8742 10.762 26.8742 11.1121V11.9972C26.8742 12.3873 27.1204 12.7374 27.4691 12.9324C27.8179 13.1275 28.2436 13.1575 28.5872 12.9624L29.2949 12.5674C29.6078 12.3923 29.9976 12.4323 30.2437 12.6874C30.6335 13.0925 30.9771 13.5475 31.2746 14.0476C31.5721 14.5477 31.8028 15.0678 31.967 15.5979C32.0747 15.933 31.9105 16.2831 31.5977 16.4581L30.8592 16.8732C30.5258 17.0582 30.3463 17.4183 30.3463 17.7934C30.3463 18.1684 30.5258 18.5285 30.8592 18.7135L31.5977 19.1286C31.9105 19.3037 32.0695 19.6537 31.967 19.9888C31.7977 20.5189 31.5669 21.039 31.2746 21.5391C30.9823 22.0392 30.6335 22.4943 30.2437 22.8994C29.9976 23.1544 29.6027 23.1944 29.2949 23.0194L28.5872 22.6243C28.2436 22.4293 27.8127 22.4593 27.4691 22.6543C27.1204 22.8494 26.8742 23.1994 26.8742 23.5895V24.4747C26.8742 24.8247 26.6434 25.1398 26.2947 25.2148C25.7562 25.3348 25.192 25.3998 24.6176 25.3998C24.0432 25.3998 23.479 25.3348 22.9405 25.2148C22.5918 25.1398 22.361 24.8247 22.361 24.4747V23.5945C22.361 23.1994 22.1097 22.8494 21.7609 22.6493C21.4122 22.4543 20.9814 22.4243 20.6326 22.6193L19.9402 23.0094C19.6274 23.1844 19.2376 23.1444 18.9914 22.8894C18.6017 22.4843 18.258 22.0292 17.9606 21.5291C17.6631 21.029 17.4323 20.5089 17.2682 19.9788C17.1605 19.6437 17.3246 19.2937 17.6375 19.1186L18.3555 18.7135C18.6889 18.5235 18.8735 18.1584 18.8735 17.7834C18.8735 17.4083 18.694 17.0432 18.3555 16.8532L17.6375 16.4481C17.3246 16.2731 17.1656 15.923 17.2682 15.5879C17.4375 15.0578 17.6631 14.5377 17.9606 14.0376C18.258 13.5375 18.6017 13.0825 18.9914 12.6774C19.2376 12.4223 19.6274 12.3823 19.9402 12.5574L20.6377 12.9474C20.9865 13.1425 21.4173 13.1125 21.7661 12.9174C22.1199 12.7224 22.3661 12.3673 22.3661 11.9722V11.1121H22.361ZM27.0845 17.7884C27.0997 17.4636 27.0472 17.1392 26.9302 16.8347C26.8132 16.5303 26.6341 16.2521 26.4038 16.017C26.1735 15.7819 25.8967 15.5948 25.5901 15.467C25.2835 15.3392 24.9536 15.2733 24.6202 15.2733C24.2867 15.2733 23.9568 15.3392 23.6502 15.467C23.3436 15.5948 23.0668 15.7819 22.8365 16.017C22.6062 16.2521 22.4271 16.5303 22.3101 16.8347C22.1931 17.1392 22.1406 17.4636 22.1558 17.7884C22.1406 18.1132 22.1931 18.4376 22.3101 18.742C22.4271 19.0465 22.6062 19.3246 22.8365 19.5597C23.0668 19.7948 23.3436 19.9819 23.6502 20.1097C23.9568 20.2376 24.2867 20.3035 24.6202 20.3035C24.9536 20.3035 25.2835 20.2376 25.5901 20.1097C25.8967 19.9819 26.1735 19.7948 26.4038 19.5597C26.6341 19.3246 26.8132 19.0465 26.9302 18.742C27.0472 18.4376 27.0997 18.1132 27.0845 17.7884Z" fill="#D8D7D7"/>
                </svg>
                <p>Set up passkey</p>
            </button>
        </div>
    )
}

export default Passkey;