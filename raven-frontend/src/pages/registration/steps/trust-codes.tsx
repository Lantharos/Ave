import {useEffect, useState, useRef} from "react";
import {Button} from "../../../components/Basic/PrimaryButton.tsx";
import FancyInput from "../../../components/Basic/FancyInput.tsx";
import {motion, AnimatePresence} from "framer-motion";
import type { Variants } from "framer-motion";

type Props = {
    handler: React.Dispatch<React.SetStateAction<number>>;
    setData: React.Dispatch<React.SetStateAction<object>>;
};

function TrustCodes({handler,setData}: Props) {
    const [randomCode, setRandomCode] = useState<string>("PRTA-8W45-AZZA-BBWA");
    const [customCode, setCustomCode] = useState<string>("");
    const [animActive, setAnimActive] = useState(false); // drives morph animation
    const revertTimer = useRef<number | null>(null);
    const restartKey = useRef<number>(0); // force remount of check animation

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

    const handleCopy = async () => {
        try { await navigator.clipboard.writeText(randomCode); } catch { /* ignore */ }
        // restart animation even if already active
        restartKey.current = Date.now();
        setAnimActive(true);
        if (revertTimer.current) window.clearTimeout(revertTimer.current);
        revertTimer.current = window.setTimeout(() => setAnimActive(false), 1700);
    };

    const copyVariants: Variants = {
        idle: { scale: 1, opacity: 1, filter: "brightness(1)" },
        morph: { scale: 0, opacity: 0, filter: "brightness(0.6)", transition: { type: "spring", stiffness: 320, damping: 26 } }
    };

    const checkVariants: Variants = {
        hidden: { scale: 0, opacity: 0, rotate: -15 },
        show: { scale: [0, 1.25, 1.1] as number[], opacity: [0, 1, 1] as number[], rotate: 0, transition: { times: [0, 0.55, 1] as number[], duration: 0.6, ease: "easeOut" } },
        exit: { scale: 0.25, opacity: 0, rotate: 15, transition: { duration: 0.35, ease: "backIn" } }
    } as const;

    return (
        <div className="flex flex-col items-start gap-20 mt-[5%]">
            <div className="flex flex-col items-start w-[700px] max-w-full gap-6 font-poppins text-light">
                <h1 className="text-[48px] font-normal leading-[1] text-left">Your Trust Codes</h1>

                <p className="text-[#878787] text-justify text-[18px] leading-[26px] space-y-4">
                    You cannot view these codes again after you make your ID, so <span className="font-bold">you should write them down somewhere.</span>
                </p>
            </div>

            <div className="flex flex-row items-start gap-50 text-left">
                <div className="flex flex-col items-start gap-5">
                    <span className="text-[24px] text-[#878787]">Random Trust Code</span>
                    <div className="flex flex-row items-center gap-5">
                        <span className="text-accent text-[32px] font-bold w-fit">{randomCode}</span>
                        <motion.button
                            type="button"
                            onClick={handleCopy}
                            whileTap={{scale: 0.9}}
                            className="relative cursor-pointer w-[46px] h-[46px] flex items-center justify-center rounded-xl bg-[rgba(32,32,32,0.70)] hover:bg-[rgba(55,55,55,0.70)] transition-colors select-none overflow-hidden"
                            aria-label="Copy trust code"
                        >
                            {/* Copy icon that shrinks away */}
                            <motion.svg
                                variants={copyVariants}
                                animate={animActive ? "morph" : "idle"}
                                width="25" height="28" viewBox="0 0 25 28" fill="none"
                                transition={{type: "spring", stiffness: 300, damping: 24}}
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <motion.path
                                    fill="#8A7B8A"
                                    d="M11.375 0H18.1617C18.8563 0 19.5234 0.278906 20.0156 0.771094L23.7289 4.48438C24.2211 4.97656 24.5 5.64375 24.5 6.33828V18.375C24.5 19.8242 23.3242 21 21.875 21H11.375C9.92578 21 8.75 19.8242 8.75 18.375V2.625C8.75 1.17578 9.92578 0 11.375 0ZM2.625 7H7V10.5H3.5V24.5H14V22.75H17.5V25.375C17.5 26.8242 16.3242 28 14.875 28H2.625C1.17578 28 0 26.8242 0 25.375V9.625C0 8.17578 1.17578 7 2.625 7Z"
                                />
                            </motion.svg>

                            {/* Check icon that grows from copy center */}
                            <AnimatePresence mode="popLayout" initial={false}>
                                {animActive && (
                                    <motion.svg
                                        key={restartKey.current}
                                        variants={checkVariants}
                                        initial="hidden"
                                        animate="show"
                                        exit="exit"
                                        width="30" height="30" viewBox="0 0 24 24" fill="none"
                                        className="absolute"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <motion.path
                                            d="M5.2 12.4L10.05 17.25L18.8 8.5"
                                            stroke="#CFC2CF"
                                            strokeWidth="2.6"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            initial={{pathLength:0}}
                                            animate={{pathLength:1, transition:{delay:0.05, duration:0.45, ease:"easeOut"}}}
                                        />
                                    </motion.svg>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </div>
                </div>

                <div className="flex flex-col items-start gap-5 w-100">
                    <span className="text-[24px] text-[#878787]">Custom Trust Code</span>
                    <FancyInput
                        placeholder={"Enter your custom trust code"}
                        onInput={(e) => {
                            const value = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
                            let formattedValue = '';
                            for (let i = 0; i < value.length; i++) {
                                if (i > 0 && i % 4 === 0) formattedValue += '-';
                                formattedValue += value[i];
                            }
                            e.currentTarget.value = formattedValue;
                            setCustomCode(formattedValue);
                        }}
                    />
                    <Button
                        icon={<svg width="10" height="18" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.63386 8.36719C10.122 8.85547 10.122 9.64844 9.63386 10.1367L2.13533 17.6367C1.64714 18.125 0.854325 18.125 0.366139 17.6367C-0.122046 17.1484 -0.122046 16.3555 0.366139 15.8672L6.98203 9.25L0.370045 2.63281C-0.118141 2.14453 -0.118141 1.35156 0.370045 0.863281C0.858231 0.375 1.65104 0.375 2.13923 0.863281L9.63777 8.36328L9.63386 8.36719Z" fill="#D8D7D7"/></svg>}
                        justify={"between"}
                        size={"md"}
                        onClick={async () => {
                            await new Promise(r => setTimeout(r, 1100));
                            setData(prev => ({...prev, trustCodes: {randomCode, customCode}}));
                            handler(5);
                        }}
                    >
                        <p>Continue</p>
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default TrustCodes;