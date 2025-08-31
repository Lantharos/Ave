import React, { useEffect, useMemo, useState } from "react";

// ----- Component -----
// Usage: <OtpInput onComplete={(code)=>console.log(code)} />
// - Auto-advances on type
// - Smart paste (handles full code or partial)
// - Backspace moves left when empty
// - Arrow key navigation
// - Optional controlled mode via `value` + `onChange`
// - Accessibile: one-time-code hints for mobile

export type OtpInputProps = {
    length?: number; // number of boxes
    value?: string; // if provided, becomes controlled
    onChange?: (value: string) => void;
    onComplete?: (value: string) => void;
    autoFocus?: boolean;
    disabled?: boolean;
    className?: string; // extra classes for the wrapper
    inputClassName?: string; // extra classes for each cell
    name?: string; // optional form field name
};

export default function OtpInput({
                                     length = 6,
                                     value,
                                     onChange,
                                     onComplete,
                                     autoFocus = true,
                                     disabled = false,
                                     className = "",
                                     inputClassName = "",
                                     name = "otp",
                                 }: OtpInputProps) {
    // Allow both controlled and uncontrolled usage
    const [internal, setInternal] = useState<string>("".padEnd(length, ""));
    const code = typeof value === "string" ? value.slice(0, length) : internal;

    // Refs for focusing cells
    const refs = useMemo(() => Array.from({ length }, () => React.createRef<HTMLInputElement>()), [length]);

    // Ensure internal state always has correct length
    useEffect(() => {
        if (typeof value !== "string" && internal.length !== length) {
            setInternal((prev) => (prev + "".repeat(length)).slice(0, length));
        }
    }, [length]);

    useEffect(() => {
        if (!autoFocus || disabled) return;
        const firstEmpty = Math.max(0, code.indexOf("") === -1 ? code.length : code.indexOf(""));
        refs[Math.min(firstEmpty, length - 1)].current?.focus();
    }, [autoFocus, disabled]);

    const setAt = (idx: number, ch: string) => {
        const chars = code.split("");
        chars[idx] = ch;
        const next = chars.join("");
        if (typeof value === "string") onChange?.(next);
        else setInternal(next);
        if (next.length === length && !next.includes("")) onComplete?.(next);
    };

    const handleChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, "");
        if (!digits) {
            setAt(idx, "");
            return;
        }
        // If user pasted multiple digits into a single cell
        const chars = code.split("");
        let i = 0;
        for (let j = idx; j < length && i < digits.length; j++, i++) {
            chars[j] = digits[i];
        }
        const next = chars.join("");
        if (typeof value === "string") onChange?.(next);
        else setInternal(next);

        const nextFocus = Math.min(idx + digits.length, length - 1);
        refs[nextFocus].current?.focus();
        if (next.length === length && !next.includes("")) onComplete?.(next);
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        const key = e.key;
        if (key === "Backspace") {
            if (!code[idx]) {
                // Move left and clear previous
                const prev = Math.max(0, idx - 1);
                setAt(prev, "");
                refs[prev].current?.focus();
                e.preventDefault();
            } else {
                setAt(idx, "");
            }
        } else if (key === "ArrowLeft") {
            e.preventDefault();
            refs[Math.max(0, idx - 1)].current?.focus();
        } else if (key === "ArrowRight") {
            e.preventDefault();
            refs[Math.min(length - 1, idx + 1)].current?.focus();
        } else if (key === "Home") {
            e.preventDefault();
            refs[0].current?.focus();
        } else if (key === "End") {
            e.preventDefault();
            refs[length - 1].current?.focus();
        }
    };

    const handlePaste = (idx: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        const text = e.clipboardData.getData("text").replace(/\D/g, "");
        if (!text) return;
        e.preventDefault();
        const chars = code.split("");
        let i = 0;
        for (let j = idx; j < length && i < text.length; j++, i++) {
            chars[j] = text[i];
        }
        const next = chars.join("");
        if (typeof value === "string") onChange?.(next);
        else setInternal(next);

        const nextFocus = Math.min(idx + text.length, length - 1);
        refs[nextFocus].current?.focus();
        if (next.length === length && !next.includes("")) onComplete?.(next);
    };

    return (
        <div className={"flex items-center justify-center gap-2 sm:gap-3 " + className}>
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={refs[i]}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    spellCheck={false}
                    name={`${name}-${i}`}
                    title={`Digit ${i + 1}`}
                    aria-label={`Digit ${i + 1}`}
                    maxLength={1}
                    value={code[i] ?? ""}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={(e) => handlePaste(i, e)}
                    disabled={disabled}
                    className={
                        "h-15 w-15 sm:h-14 sm:w-12 rounded-2xl text-center text-lg sm:text-xl font-medium tracking-widest " +
                        "text-white/90 placeholder:text-white/20 outline-none " +
                        "bg-[rgba(17,17,17,0.75)] border border-white/10 " +
                        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] " +
                        "focus:ring-2 focus:ring-white/30 focus:border-white/20 disabled:opacity-50 " +
                        inputClassName
                    }
                />
            ))}
        </div>
    );
}

// ----- Demo sandbox (optional) -----
export function OtpDemo() {
    const [code, setCode] = useState("");
    return (
        <div className="min-h-[220px] w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 rounded-3xl">
            <p className="mb-4 text-white/70">Enter the 6‑digit code</p>
            <OtpInput value={code} onChange={setCode} onComplete={(v) => alert(`Code: ${v}`)} />
            <p className="mt-4 text-white/50 text-sm">Value: {code || "(empty)"}</p>
        </div>
    );
}
