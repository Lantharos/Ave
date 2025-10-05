// src/state/MekContext.tsx
import React, { createContext, useContext, useState } from "react";

type MekState = { mek: Uint8Array | null; setMek: (m: Uint8Array | null) => void };

const Ctx = createContext<MekState | null>(null);

export function MekProvider({ children }: { children: React.ReactNode }) {
    const [mek, setMek] = useState<Uint8Array | null>(null);
    return <Ctx.Provider value={{ mek, setMek }}>{children}</Ctx.Provider>;
}

export function useMEK() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useMEK outside MekProvider");
    return ctx;
}
