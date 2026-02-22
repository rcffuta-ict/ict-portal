import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

interface IctLogoProps {
    /**
     * 'colored' = The Navy Blue logo (Use on light backgrounds)
     * 'white'   = The White logo (Use on dark backgrounds like Sidebar/Hero)
     */
    variant?: "colored" | "white";
    className?: string;
    width?: number;
    height?: number;
    asLink?: boolean; // If true, wraps in a Link to home
}

export function IctLogo({
    variant = "colored",
    className,
    width = 140,
    height = 50,
    asLink = false,
}: IctLogoProps) {
    const src =
        variant === "colored"
            ? "/logo/logo-512x297_(1).png"
            : "/logo/logo-alt-511x291_.png";

    const LogoImage = (
        <div className={clsx("relative flex items-center", className)}>
            <Image
                src={src}
                alt="RCF FUTA Logo"
                width={width}
                height={height}
                className="object-contain h-auto w-auto" // Ensures aspect ratio is kept
                priority
            />
        </div>
    );

    if (asLink) {
        return (
            <Link
                href="https://ict.rcffuta.com"
                target="_blank"
                className="hover:opacity-90 transition-opacity inline-block"
            >
                {LogoImage}
            </Link>
        );
    }

    return LogoImage;
}
