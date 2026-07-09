import clsx from "clsx";


export function AvatarDisplay({url, initials, size = "md", className}: {url?: string; initials: string, size?: "sm" | "md" | "lg", className?: string}) {
    return (
        <div className={clsx("rounded-full border-4 border-white/20 bg-white/10 flex items-center justify-center font-bold overflow-hidden shadow-inner", {
            "h-10 w-10 shrink-0 text-sm": size === "sm",
            "h-28 w-28 text-3xl": size === "md",
            "h-36 w-36 text-4xl": size === "lg"
        }, className)}>
                {url ? (
                    <img
                        src={url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span>
                        {initials}
                    </span>
                )}
            </div>
    )
}
