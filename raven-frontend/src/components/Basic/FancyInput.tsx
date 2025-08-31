import React from "react";

type FancyInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    helperText?: string;
    error?: boolean;
};

export default function FancyInput({
                                       label,
                                       className = "",
                                       helperText,
                                       error = false,
                                       ...props
                                   }: FancyInputProps) {
    return (
        <div className="w-full flex flex-col gap-1 items-start">
            {label && (
                <label className="text-sm text-white/70 font-medium">{label}</label>
            )}
            <input
                {...props}
                className={`
          w-full h-[50px] px-[15px]
          rounded-[16px]
          bg-[rgba(32,32,32,0.70)]
          text-[#d3d3d3] font-poppins text-[18px] font-normal leading-none
          placeholder:text-[#5A5A5A]
          outline-none border ${
                    error
                        ? "border-[rgba(255,99,99,0.45)] focus:border-[rgba(255,99,99,0.65)] focus:ring-2 focus:ring-[rgba(255,99,99,0.25)]"
                        : "border-[rgba(255,255,255,0.08)] focus:border-[rgba(255,255,255,0.18)] focus:ring-2 focus:ring-[rgba(255,255,255,0.12)]"
                }
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_2px_6px_rgba(0,0,0,0.35)]
          transition-colors
          ${className}
        `}
            />
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
    );
}