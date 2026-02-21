"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function DeviceWrapper({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isTvDisplay = pathname === "/oracle" || pathname === "/oracle/stats";

    if (isTvDisplay) {
        return <div className="tv-layout">{children}</div>;
    }

    return (
        <div className="mobile-layout-wrapper">
            <div className="mobile-container">{children}</div>
        </div>
    );
}
