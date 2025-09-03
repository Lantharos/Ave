import {useEffect, useRef, useState} from "react";

type Option = { label: string; value: string };
// extend props with optional error + helperText
type Props = {
    options: Option[];
    placeholder?: string;
    value?: string;                 // controlled (optional)
    onChange?: (value: string) => void;
    className?: string;             // to override container if needed
    error?: boolean;                // error state
    helperText?: string;            // helper/error message
};

export default function FancySelect({options, placeholder = "Select a question", value, onChange, className = "", error = false, helperText}: Props) {
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string | undefined>(value);
    const [highlight, setHighlight] = useState<number>(-1);
    const ref = useRef<HTMLDivElement | null>(null);

    // keep internal state in sync if used as controlled
    useEffect(() => setInternalValue(value), [value]);

    // close on click outside
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selected = options.find(o => o.value === internalValue);

    const applyValue = (v: string) => {
        setInternalValue(v);
        onChange?.(v);
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
            setHighlight(Math.max(0, options.findIndex(o => o.value === internalValue)));
            return;
        }

        if (!open) return;

        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight(h => (h + 1) % options.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight(h => (h - 1 + options.length) % options.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = options[highlight] ?? options[0];
            if (target) applyValue(target.value);
        }
    };

    return (
        <div ref={ref} className={`w-full flex flex-col items-start gap-1 ${className}`}>
            <div className="relative w-full">
                <button
                    type="button"
                    className={`flex h-[50px] w-full items-center justify-between rounded-[16px] bg-[rgba(32,32,32,0.70)] px-[15px] text-left outline-none border font-poppins text-[18px] placeholder:text-muted transition-colors
                        ${error
                        ? "border-[rgba(255,99,99,0.45)] focus:border-[rgba(255,99,99,0.65)] focus:ring-2 focus:ring-[rgba(255,99,99,0.25)]"
                        : "border-[rgba(255,255,255,0.08)] focus:border-[rgba(255,255,255,0.18)] focus:ring-2 focus:ring-[rgba(255,255,255,0.12)]"}
                    `}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-invalid={error || undefined}
                    onClick={() => setOpen(o => !o)}
                    onKeyDown={onKeyDown}
                >
            <span className={selected ? "text-light" : `text-muted ${error ? "text-[rgba(255,140,140,0.9)]" : ""}`}>
              {selected ? selected.label : placeholder}
            </span>

                    {/* Chevron */}
                    <svg
                        width="12"
                        height="7"
                        viewBox="0 0 12 7"
                        className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M5.29365 6.70627C5.68428 7.0969 6.31865 7.0969 6.70928 6.70627L11.7093 1.70627C12.0999 1.31565 12.0999 0.681274 11.7093 0.290649C11.3187 -0.0999756 10.6843 -0.0999756 10.2937 0.290649L5.9999 4.5844L1.70615 0.293774C1.31553 -0.0968509 0.681152 -0.0968509 0.290527 0.293774C-0.100098 0.684399 -0.100098 1.31877 0.290527 1.7094L5.29053 6.7094L5.29365 6.70627Z" fill={error ? "#FF8C8C" : "#878787"}/>
                    </svg>
                </button>

                {/* Dropdown panel */}
                {open && (
                    <ul
                        role="listbox"
                        tabIndex={-1}
                        className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-[14px] bg-[rgba(32,32,32,0.95)] backdrop-blur-md shadow-lg ring-1 ring-black/30"
                    >
                        {options.map((opt, i) => {
                            const isSelected = opt.value === internalValue;
                            const isActive = i === highlight;
                            return (
                                <li
                                    key={opt.value}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`flex cursor-pointer items-center justify-between px-4 py-2 font-poppins text-[16px] 
                  ${isActive ? "bg-[rgba(138,123,138,0.25)]" : ""} 
                  ${isSelected ? "text-light" : "text-[#c9c9c9] hover:text-light"}`}
                                    onMouseEnter={() => setHighlight(i)}
                                    onMouseDown={(e) => e.preventDefault()}   // prevent button blur
                                    onClick={() => applyValue(opt.value)}
                                >
                                    <span>{opt.label}</span>
                                    {isSelected && (
                                        <span className="text-muted text-[12px]">•</span>
                                    )}
                                </li>
                            );
                        })}
                        {options.length === 0 && (
                            <li className="px-4 py-2 text-[14px] text-muted font-poppins">No options</li>
                        )}
                    </ul>
                )}
            </div>
            {helperText && (
                <span className={`pl-[20px] ${error ? "text-[rgba(255,140,140,0.9)]" : "text-white/50"} text-sm`}>{helperText}</span>
            )}
        </div>
    );
}
