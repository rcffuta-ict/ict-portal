import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import DeviceWrapper from "@/src/components/common/DeviceWrapper";
import "../styles/style.scss";

export const metadata: Metadata = {
    title: "Combined Family Meeting — Redeemed Christian Fellowship FUTA Chapter",
    description: "Powered by RCF FUTA ICT",
    icons: { icon: "/images/Logo/logo.png" },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <DeviceWrapper>{children}</DeviceWrapper>
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: "rgba(10, 16, 40, 0.9)",
                            color: "#ECF2FF",
                            border: "1px solid rgba(189, 36, 223, 0.3)",
                            borderRadius: "12px",
                            padding: "12px 16px",
                            fontSize: "15px",
                            backdropFilter: "blur(12px)",
                            fontFamily: "'Outfit', sans-serif",
                        },
                        success: {
                            iconTheme: {
                                primary: "#2D6ADE",
                                secondary: "#fff",
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: "#BD24DF",
                                secondary: "#fff",
                            },
                        },
                    }}
                />
            </body>
        </html>
    );
}
