import React, { useState } from "react";

type ButtonProps = {
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
    className?: string;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right" | "only";
    size?: "sm" | "md" | "lg" | "pill";
    fullWidth?: boolean;
    justify?: "center" | "between";
    disabled?: boolean;
    asSubmit?: boolean;
    loading?: boolean;
    ariaLabel?: string;
    customMiddleGap?: number; // in px
};

function cn(...parts: Array<string | false | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export function Spinner({ className = "" }: { className?: string }) {
    return (
        <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" width={20} height={20} aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
    );
}

export function Button({
                           children,
                           onClick,
                           className = "",
                           icon,
                           iconPosition = "left",
                           size = "md",
                           fullWidth = true,
                           justify = "center",
                           disabled,
                           asSubmit,
                           loading: loadingProp,
                           ariaLabel,
                           customMiddleGap,
                       }: ButtonProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const loading = loadingProp ?? internalLoading;

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!onClick) return;
        const maybePromise = onClick(e);
        if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
            try {
                setInternalLoading(true);
                await (maybePromise as Promise<void>);
            } finally {
                setInternalLoading(false);
            }
        }
    };

    const isDisabled = disabled || loading;

    const base = cn(
        "flex items-center select-none transition-colors duration-300 border-none outline-none font-poppins font-medium",
        fullWidth && "w-full",
        !isDisabled && "cursor-pointer bg-[#8A7B8A] text-[#D8D7D7] hover:bg-[#a190a1] active:bg-[#635963]",
        isDisabled && "bg-[#8A7B8A] text-[#D8D7D7] opacity-60 cursor-not-allowed",
    );

    const sizing =
        size === "sm"
            ? "h-[50px] rounded-[16px] text-[18px] leading-[22px] gap-[10px] px-[13px]"
            : size === "lg"
                ? "h-[70px] rounded-[24px] text-[24px] leading-[22px] gap-7 pr-12 pl-[34px]"
                : size === "pill"
                    ? "h-[60px] rounded-[32px] text-[18px] gap-7 px-[10px]"
                    : "h-[50px] rounded-[16px] text-[18px] leading-[22px] gap-[10px] px-[16px]";

    const layout = justify === "between" ? "justify-between" : "justify-center";

    // Use a CSS variable for the gap so Tailwind can emit "gap-[var(--mid-gap)]" once.
    // Allow 0 explicitly: if customMiddleGap is undefined, fall back to 10.
    const middleGapClass =
        justify !== "between" && iconPosition !== "only" ? "gap-[var(--mid-gap)]" : undefined;

    const middleGapStyle: React.CSSProperties | undefined =
        justify !== "between" && iconPosition !== "only"
            ? ({ ["--mid-gap" as any]: `${customMiddleGap ?? 10}px` } as React.CSSProperties)
            : undefined;

    return (
        <button
            type={asSubmit ? "submit" : "button"}
            aria-label={ariaLabel}
            disabled={isDisabled}
            onClick={handleClick}
            className={cn(base, sizing, layout, className)}
        >
            {/* Left slot (only used for justify-between) */}
            {justify === "between" && (
                <span className={cn("flex items-center", loading && "opacity-0")}>{icon}</span>
            )}

            {/* Middle slot */}
            <span className={cn("flex items-center", middleGapClass)} style={middleGapStyle}>
        {loading ? (
            <Spinner className={cn(size === "lg" ? "w-6 h-6" : "w-5 h-5")} />
        ) : justify === "between" ? (
            <span>{children}</span>
        ) : (
            <>
                {iconPosition === "left" && icon}
                {iconPosition !== "only" && <span>{children}</span>}
                {iconPosition === "right" && icon}
            </>
        )}
      </span>

            {/* Right slot (invisible for balance when justify-between) */}
            {justify === "between" && <span className="opacity-0">{icon}</span>}
        </button>
    );
}
