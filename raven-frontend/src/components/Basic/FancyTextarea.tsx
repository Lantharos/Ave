import React, { useEffect, useRef } from "react";

type FancyTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    helperText?: string;
    error?: boolean;
    showCount?: boolean; // show character counter when maxLength provided
    autoResize?: boolean; // grow with content
    minRows?: number;
    maxRows?: number; // soft cap when autoResize is on
};

export function FancyTextarea({
                                  label,
                                  className = "",
                                  helperText,
                                  error = false,
                                  showCount = true,
                                  autoResize = true,
                                  minRows = 4,
                                  maxRows,
                                  maxLength,
                                  onInput,
                                  onChange,
                                  ...props
                              }: FancyTextareaProps) {
    const ref = useRef<HTMLTextAreaElement | null>(null);

    const resize = () => {
        if (!ref.current || !autoResize) return;
        const el = ref.current;
        // reset to auto to measure scrollHeight correctly
        el.style.height = "auto";
        let next = el.scrollHeight;
        // enforce maxRows if provided
        if (maxRows) {
            const line = 24; // px, good fit for text-[18px]
            const verticalPadding = 10 + 10; // py-[10px]
            const cap = maxRows * line + verticalPadding;
            next = Math.min(next, cap);
        }
        el.style.height = `${next}px`;
    };

    useEffect(() => {
        resize();
    }, [props.value]);

    const base = `
    w-full px-[15px] py-[10px]
    rounded-[16px]
    bg-[rgba(32,32,32,0.70)]
    text-[#d3d3d3] font-poppins text-[18px]
    placeholder:text-[#5A5A5A]
    outline-none border ${error ? "border-[rgba(255,99,99,0.45)]" : "border-[rgba(255,255,255,0.08)]"}
    shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_2px_6px_rgba(0,0,0,0.35)]
    focus:${error ? "border-[rgba(255,99,99,0.65)] ring-2 ring-[rgba(255,99,99,0.25)]" : "border-[rgba(255,255,255,0.18)] ring-2 ring-[rgba(255,255,255,0.12)]"}
    transition-colors
    resize-none
  `;

    const handleInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
        resize();
        onInput?.(e);
    };

    const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        onChange?.(e);
    };

    return (
        <div className="w-full flex flex-col gap-1">
            {label && (
                <label className="text-sm text-white/70 font-medium">{label}</label>
            )}
            <div className="relative">
        <textarea
            ref={ref}
            rows={minRows}
            maxLength={maxLength}
            onInput={handleInput}
            onChange={handleChange}
            className={[base, className].join(" ")}
            {...props}
        />
                {maxLength && showCount && (
                    <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-white/40 font-poppins">
                        {`${(props.value?.toString().length ?? 0)}/${maxLength}`}
                    </div>
                )}
            </div>
            <div className={"flex flex-col w-full gap-2 items-start"}>
                {helperText && (
                    <span
                        className={`pl-[20px] ${
                            error
                                ? "text-[rgba(255,140,140,0.9)] text-sm"
                                : "text-white/50 text-sm"
                        }`}
                    >
                    {helperText}
                </span>
                )}
            </div>

        </div>
    );
}