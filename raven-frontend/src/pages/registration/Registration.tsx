import {useEffect, useRef, useState} from "react";
import Start from "./steps/start.tsx";
import Password from "./steps/password.tsx";
import Methods from "./steps/methods.tsx";
import Passkey from "./steps/passkey.tsx";
import SecurityQuestions from "./steps/security-questions.tsx";
import TrustCodes from "./steps/trust-codes.tsx";
import Profile from "./steps/profile.tsx";
import PrivacyPolicy from "./steps/privacy.tsx";
import TermsOfUse from "./steps/terms.tsx";
import RavenLogoMotion from "../../components/RavenLogo.tsx";
import Aurora from "../../components/Backgrounds/Aurora.tsx";
import Finalize from "./steps/finalize.tsx";
import {
    deriveKekFromPassword,
    hashSecurityAnswer,
    hashTrustCode,
    initCrypto,
    newMEK,
    randomBytes,
    s,
    wrapMEK
} from "../../util/crypto/crypto.ts";
import {apiPOST} from "../../util/api.ts";
import {useMEK} from "../../util/MekContext.tsx";

type RegisterBody = {
    acceptedPrivacy: boolean;
    acceptedTerms: boolean;
    methods: Record<string, boolean>;
    profile: { displayName: string; username: string; bio?: string; avatar?: string | null };
    // IMPORTANT: hash security answers & trust codes client-side before sending
    securityQuestions?: { q: string; answerHash: string }[];
    trustCodes?: { codeHash: string }[];
    // server will store password hash, but we ALSO use password to wrap MEK client-side
    password: string;
};

export default function Registration() {
    const [step, setStep] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<Record<string, any>>({});
    const [contentOverflowing, setContentOverflowing] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { setMek } = useMEK();

    async function registerToBackend() {
        const form: RegisterBody = {
            acceptedPrivacy: data.acceptedPrivacy,
            acceptedTerms: data.acceptedTerms,
            methods: data.methods,
            profile: data.profile,
            password: data.password
        };

        // 1) validate form (should be already validated, but double-check)
        if (!form.acceptedPrivacy || !form.acceptedTerms) throw new Error("You must accept the privacy policy and terms of use.");
        if (!form.profile || !form.profile.displayName || !form.profile.username) throw new Error("Profile information is incomplete.");
        if (!form.password || form.password.length < 8) throw new Error("Password is too short.");

        await initCrypto()

        const MEK = newMEK()

        const salt = randomBytes(16);
        const KEK = await deriveKekFromPassword(form.password, salt);

        // helpers: normalize incoming shapes to arrays you can map over
        const toQuestionArray = (input: unknown): Array<{ q: string; value: string }> => {
            if (!input) return [];
            if (Array.isArray(input)) return input as Array<{ q: string; value: string }>;
            if (typeof input === "object") {
                // handle dict form: { "question": "answer", ... }
                const obj = input as Record<string, unknown>;
                // also handle single object form: { q: "...", value: "..." }
                if ("q" in obj && "value" in obj) {
                    return [{ q: String((obj as any).q), value: String((obj as any).value) }];
                }
                return Object.entries(obj).map(([q, value]) => ({ q, value: String(value ?? "") }));
            }
            // anything else -> ignore
            return [];
        };

        const toTrustCodeArray = (input: unknown): Array<{ code: string }> => {
            if (!input) return [];
            if (Array.isArray(input)) {
                return (input as Array<any>).map((item) =>
                    typeof item === "string" ? { code: item } : { code: String(item.code ?? "") }
                );
            }
            // single string or single object
            if (typeof input === "string") return [{ code: input }];
            if (typeof input === "object") {
                return [{ code: String((input as any).code ?? "") }];
            }
            return [];
        };

        try {
            // SECURITY QUESTIONS
            const sqItems = toQuestionArray((data as any).securityQuestions);
            if (sqItems.length) {
                form.securityQuestions = await Promise.all(
                    sqItems.map(async (item) => {
                        const { encoded } = await hashSecurityAnswer(item.value, data.profile.username);
                        return { q: item.q, answerHash: encoded };
                    })
                );
            } else {
                form.securityQuestions = undefined;
            }

            // TRUST CODES
            const tcItems = toTrustCodeArray((data as any).trustCodes);
            if (tcItems.length) {
                form.trustCodes = await Promise.all(
                    tcItems.map(async (item) => {
                        const { encoded } = await hashTrustCode(item.code, data.profile.username);
                        return { codeHash: encoded };
                    })
                );
            } else {
                form.trustCodes = undefined;
            }
        } catch (e) {
            console.error("Hashing error:", e);
            throw new Error("Failed to hash security answers or trust codes.");
        }

        // 3) send profile to server (NO MEK)
        const registerResp = await apiPOST<{ user: never; deviceId: string }>(
            "/auth/register",
            form
        );

        const deviceId = registerResp.deviceId;

        // 4) wrap MEK with KEK; use deviceId as AAD (binds blob to this device)
        const aad = new TextEncoder().encode(deviceId);
        const { ciphertext, nonce } = await wrapMEK(KEK, MEK, aad);

        // 5) upload wrapped blob to server
        await apiPOST("/keys/mek/upload", {
            deviceId,
            type: "mek",
            algo: "xchacha20poly1305",
            wrapped: s.toB64(ciphertext),
            nonce: s.toB64(nonce),
            salt: s.toB64(salt),
        });

        // 6) store MEK in context
        setMek(MEK);
    }

    function returnStepComponent() {
        switch (step) {
            case 0:
                return <Start handler={setStep} setData={setData} />
            case 1:
                return (
                    <div>
                        <h1 className={"font-poppins text-[48px]"}>How did you get here?</h1>
                        <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                            You sneaky goose, there are no secrets here, just go back to the homepage.
                        </p>
                        <div className="mt-10">
                            <RavenLogoMotion onClick={() => window.location.href = "/"} size={100} />
                        </div>
                    </div>
                )
            case 2:
                return <Password handler={setStep} setData={setData} />
            case 3:
                return <Methods handler={setStep} setData={setData} />
            case 4:
                return <Passkey handler={setStep} setData={setData} />
            case 5:
                if (data.methods?.["security-questions"] === true && !data.securityQuestions) {
                    return <SecurityQuestions handler={setStep} setData={setData} />
                } else if (data.methods?.["trust-codes"] === true && !data.trustCodes) {
                    return <TrustCodes handler={setStep} setData={setData} />
                } else {
                    setStep(6);
                    return <Start handler={setStep} setData={setData} />
                }
            case 6:
                return <Profile handler={setStep} setData={setData} />
            case 7:
                return <PrivacyPolicy handler={setStep} setData={setData} />
            case 8:
                return <TermsOfUse handler={setStep} setData={setData} />
            case 9:
                return <Finalize waitFor={registerToBackend()} onComplete={() => {
                    window.location.href="/dashboard"
                }} />
            default:
                return <Start handler={setStep} setData={setData} />
        }
    }

    // Recalculate on step change & resize
    useEffect(() => {
        function check() {
            if (!containerRef.current) return;
            // If scroll height exceeds client height we have overflow
            const el = containerRef.current;
            setContentOverflowing(el.scrollHeight > el.clientHeight + 5); // +5 tolerance
        }
        check();
        const r = () => requestAnimationFrame(check);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, [step]);

    return (
        <div ref={containerRef} className="min-h-screen flex flex-col w-full relative">
            <div className="flex justify-between items-start w-full relative top-0 left-0 right-0">
                <div className="m-[15px]">
                    <RavenLogoMotion onClick={() => window.location.href = "/"} size={60} />
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 mt-[10px] flex w-[1000px] h-[10px] items-center gap-[5px] shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="198" height="4" viewBox="0 0 198 4" fill="none">
                        <path d="M2 0C0.89543 0 0 0.89543 0 2C0 3.10457 0.89543 4 2 4V0ZM2 4H198V0H2V4Z" fill={step == 0 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 1 || step == 2 || step == 3 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 4 || step == 5 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 6 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="196" height="4" viewBox="0 0 196 4" fill="none">
                        <path d="M0 2H196" strokeWidth="4" stroke={step == 7 || step == 8 || step == 9 ? "#8A7B8A" : "#2E2D2D"}/>
                    </svg>
                </div>
            </div>
            <div className="flex flex-col justify-center items-center text-center z-10 h-auto relative px-4 w-screen">
                {returnStepComponent()}
            </div>
            {/*<div className={(contentOverflowing ? "mt-[100px]" : "mt-auto") + " w-screen h-[250px] font-poppins shrink-0"} style={{background: "linear-gradient(180deg, #090909 10%, rgba(41,37,41,0.83) 100%)"}}></div>*/}
            <div className={(contentOverflowing ? "mt-[100px]" : "mt-auto") + " w-screen h-[300px] font-poppins shrink-0 rotate-180"}>
                <Aurora amplitude={0.3} blend={1} speed={0.7} colorStops={["#4a424a", "#4a424a", "#4a424a"]} />
            </div>
        </div>
    )
}