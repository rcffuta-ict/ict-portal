import { Copyright } from "@/components/ui/copyright";
import { getActiveTenureName } from "@/utils/action";

export default async function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const tenureName = await getActiveTenureName();
    return (
        <>
            {children}

            <footer className="w-full bg-slate-100/50 border-t border-slate-200">
                <div className="max-w-6xl mx-auto px-6 py-8 flex justify-center">
                    <Copyright
                        tenure={tenureName}
                        variant="dark"
                        className="text-center"
                    />
                </div>
            </footer>
        </>
    );
}
