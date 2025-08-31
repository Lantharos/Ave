"use client";
import { motion } from "framer-motion";
import { useState } from "react";

interface RavenLogoProps {
    size?: number;        // base px size
    onClick?: () => void;
}

export default function RavenLogoMotion({ size = 72, onClick }: RavenLogoProps) {
    const [pulse, setPulse] = useState(0);

    // from your SVG
    const CX = 34.5;
    const CY = 23.5;

    return (
        <motion.button
            type="button"
            aria-label="Raven Logo"
            style={{ width: size, height: size }}
            className="relative rounded-full focus:outline-none cursor-pointer select-none"
            onClick={() => { setPulse(p => p + 1); onClick?.(); }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 58 56"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* CORE — no movement, stay concentric */}
                <g>
                    <circle cx={CX} cy={CY} r={23.5} fill="#8A7B8A" />
                    <circle cx={CX} cy={CY} r={20.5} fill="#5A4B5A" />
                </g>

                {/* ORBITER — smooth shrink + continuous orbit ONLY while hovered */}
                <g transform={`translate(${CX} ${CY})`}>
                    <motion.g
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                        style={{ transformOrigin: "0px 0px" }}
                    >
                        {/* original position: (21,35) -> offset from center = (-13.5, 11.5) */}
                        <motion.circle
                            cx={-13.5}
                            cy={11.5}
                            r={21}
                            fill="#7B6C7B"
                            whileHover={{ r: 17 }} // smooth, not snapping
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </motion.g>
                </g>

                {/* CLICK SHOCKWAVE */}
                <motion.circle
                    key={pulse}              // retrigger on each click
                    cx={CX} cy={CY}
                    r={0}
                    stroke="#D8D7D7"
                    strokeWidth="1.5"
                    fill="none"
                    initial={{ opacity: 0, r: 0 }}
                    animate={{ opacity: [0.6, 0], r: 42 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    style={{ pointerEvents: "none" }}
                />
            </svg>
        </motion.button>
    );
}
