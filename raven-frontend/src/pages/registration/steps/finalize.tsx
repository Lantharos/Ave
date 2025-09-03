import {useEffect, useState, useRef} from "react";
import {motion, AnimatePresence} from "framer-motion";

// Lightweight finalization animation component
// Props: optional onComplete callback if parent wants to react to success
// data: registration payload (not sent here – placeholder for future API integration)
// Extend props with optional backend promise to await
// waitFor: pass a Promise from backend call; if not provided, a simulated one will run
// onError (optional): handle rejection state

type Props = {
    onComplete?: () => void;
    waitFor?: Promise<void>;
    onError?: (err: unknown) => void;
};

const TASKS = [
    "Encrypting profile",
    "Securing authentication methods",
    "Generating recovery assets",
    "Hardening session",
    "Finalizing"
];

export default function Finalize({onComplete, waitFor, onError}: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [pipelineDone, setPipelineDone] = useState(false); // tasks animation done
    const [backendDone, setBackendDone] = useState(false);   // backend promise resolved
    const [done, setDone] = useState(false);                 // both complete -> success
    const [failed, setFailed] = useState(false);

    const timeouts = useRef<number[]>([]);
    const cleared = useRef(false);

    // Build or fallback backend promise
    useEffect(() => {
        let backendPromise = waitFor;
        if (!backendPromise) {
            // simulate ~3.5s backend latency (can overlap with tasks)
            backendPromise = new Promise(res => setTimeout(res, 3500));
        }
        backendPromise
            .then(() => {
                if (cleared.current) return;
                setBackendDone(true);
            })
            .catch(err => {
                if (cleared.current) return;
                setFailed(err);
                onError?.(err);
            });
        return () => { cleared.current = true; };
    }, [waitFor, onError]);

    // Drive task progression timeline
    useEffect(() => {
        const stepInterval = 800; // ms between task activation (faster)
        TASKS.forEach((_, i) => {
            const id = window.setTimeout(() => {
                if (cleared.current) return;
                setActiveIndex(prev => (i > prev ? i : prev));
                if (i === TASKS.length - 1) {
                    setPipelineDone(true);
                }
            }, i * stepInterval);
            timeouts.current.push(id);
        });
        return () => {
            timeouts.current.forEach(id => window.clearTimeout(id));
            timeouts.current = [];
        };
    }, []);

    // Sync logic: mark finished when both done & no failure
    useEffect(() => {
        if (failed) return;
        // Fast-forward tasks if backend done early
        if (backendDone && !pipelineDone) {
            setActiveIndex(TASKS.length - 1);
            setPipelineDone(true);
        }
        if (backendDone && pipelineDone && !done) {
            const id = window.setTimeout(() => {
                if (cleared.current) return;
                setDone(true);
                onComplete?.();
            }, 450); // small grace
            return () => window.clearTimeout(id);
        }
    }, [backendDone, pipelineDone, done, failed, onComplete]);

    const showSpinner = !done && !failed;

    // Dynamic message
    let message: string;
    if (failed) message = "Something went wrong. Please retry.";
    else if (done) message = "Your ID is secured and ready to use.";
    else if (backendDone && !done) message = "Wrapping up final tasks...";
    else message = "Securely finalizing with end‑to‑end encryption...";

    return (
        <div className="flex flex-col items-center gap-10 w-full">
            <div className="flex flex-col items-center gap-6">
                <div className="relative w-[140px] h-[140px] flex items-center justify-center">
                    {/* Spinning ring (hidden once done or failed) */}
                    <AnimatePresence>
                        {showSpinner && (
                            <motion.div
                                key="spinner"
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: "conic-gradient(from 0deg, #8A7B8A, #4a424a, rgba(138,123,138,0.15), #8A7B8A)",
                                    WebkitMask: "radial-gradient(circle, black 62%, transparent 64%)"
                                }}
                                animate={{rotate: 360}}
                                transition={{repeat: Infinity, duration: 1.25, ease: "linear"}}
                            />
                        )}
                    </AnimatePresence>
                    {/* Soft inner plate */}
                    <motion.div
                        className="absolute w-[88px] h-[88px] rounded-full bg-[rgba(74,66,74,0.28)] shadow-[0_0_10px_rgba(138,123,138,0.25)_inset]"/>

                    {/* Success check */}
                    <AnimatePresence>
                        {done && !failed && (
                            <motion.svg
                                key="check"
                                initial={{scale: 0.85, opacity: 0}}
                                animate={{scale: [0.85,1.08,1], opacity: 1}}
                                exit={{opacity:0}}
                                transition={{duration: 0.55, ease: "easeOut", times:[0,0.55,1]}}
                                width="48" height="48" viewBox="0 0 48 48" fill="none"
                                shapeRendering="geometricPrecision"
                            >
                                <motion.path
                                    d="M12 25L21 34L37 16"
                                    stroke="#E3DEE3"
                                    strokeWidth={4}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                    initial={{pathLength:0}}
                                    animate={{pathLength:1}}
                                    transition={{duration:0.45, ease:"easeOut", delay:0.1}}
                                />
                            </motion.svg>
                        )}
                    </AnimatePresence>

                    {/* Error X */}
                    <AnimatePresence>
                        {failed && (
                            <motion.svg
                                key="error"
                                initial={{scale:0.7, opacity:0}}
                                animate={{scale:1, opacity:1}}
                                exit={{opacity:0}}
                                transition={{duration:0.4}}
                                width="70" height="70" viewBox="0 0 48 48" fill="none" shapeRendering="geometricPrecision"
                            >
                                <motion.path
                                    d="M16 16L32 32M32 16L16 32"
                                    stroke="#FF8C8C"
                                    strokeWidth={4}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </motion.svg>
                        )}
                    </AnimatePresence>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                    {!done && !failed ? (
                        <motion.h1
                            key="creating"
                            initial={{opacity:0, y:8}}
                            animate={{opacity:1, y:0}}
                            exit={{opacity:0, y:-8}}
                            transition={{duration:0.3}}
                            className="text-[#D8D7D7] text-center font-montserratAlt text-[56px] font-[500] leading-none"
                        >
                            Creating your ID
                        </motion.h1>
                    ) : failed ? (
                        <motion.h1
                            key="error-h"
                            initial={{opacity:0, scale:0.9}}
                            animate={{opacity:1, scale:1}}
                            transition={{duration:0.4, ease:"easeOut"}}
                            className="text-[#FF8C8C] text-center font-montserratAlt text-[60px] font-[500] leading-none"
                        >
                            Error
                        </motion.h1>
                    ) : (
                        <motion.h1
                            key="ready"
                            initial={{opacity:0, scale:0.92}}
                            animate={{opacity:1, scale:1}}
                            transition={{duration:0.45, ease:"easeOut"}}
                            className="text-[#D8D7D7] text-center font-montserratAlt text-[68px] font-[500] leading-none"
                        >
                            You're in.
                        </motion.h1>
                    )}
                </AnimatePresence>
                <motion.p
                    key={message}
                    initial={{opacity:0, y:4}}
                    animate={{opacity:1, y:0}}
                    transition={{duration:0.4}}
                    className={`text-center font-poppins text-[20px] font-normal ${failed ? "text-[#FF8C8C]" : "text-[#878787]"}`}
                >
                    {message}
                </motion.p>
            </div>

            {/* Task list */}
            <div className="w-[520px] max-w-[90vw] flex flex-col gap-2">
                {TASKS.map((t, i) => {
                    const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "idle";
                    return (
                        <motion.div
                            key={t}
                            layout
                            initial={{opacity:0, y:6}}
                            animate={{opacity:1, y:0}}
                            className="flex items-center gap-3 font-poppins text-[15px]"
                        >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors duration-300 ${state === "done" ? "bg-[rgba(138,123,138,0.35)]" : state === "active" ? "bg-[rgba(138,123,138,0.18)]" : "bg-[rgba(255,255,255,0.05)]"} ${failed ? "opacity-40" : ""}`}>
                                {state === "done" && !failed && (
                                    <motion.span
                                        initial={{scale:0, opacity:0}}
                                        animate={{scale:1, opacity:1}}
                                        className="text-[11px] text-[#D8D7D7]"
                                    >
                                        ✓
                                    </motion.span>
                                )}
                                {state === "active" && !failed && (
                                    <motion.span
                                        className="w-2 h-2 rounded-full bg-[#8A7B8A] block"
                                        initial={{scale:0.4, opacity:0.4}}
                                        animate={{scale:[0.4,1,0.4], opacity:[0.4,1,0.4]}}
                                        transition={{repeat: Infinity, duration:1.05, ease:"easeInOut"}}
                                    />
                                )}
                            </div>
                            <span className={`${failed ? 'text-[#5a5a5a]' : state !== 'idle' ? 'text-[#D8D7D7]' : 'text-[#5a5a5a]'} transition-colors duration-300`}>{t}</span>
                        </motion.div>
                    );
                })}
            </div>

            {failed && (
                <motion.button
                    whileTap={{scale:0.95}}
                    onClick={() => {
                        // simple retry: reset state & rerun sequences
                        setFailed(false);
                        setActiveIndex(0);
                        setPipelineDone(false);
                        setBackendDone(false);
                        setDone(false);
                        cleared.current = false;
                    }}
                    className="mt-4 px-6 py-2 rounded-xl bg-[rgba(255,140,140,0.15)] hover:bg-[rgba(255,140,140,0.25)] text-[#FF8C8C] font-poppins text-sm transition-colors"
                >
                    Retry
                </motion.button>
            )}
        </div>
    );
}
