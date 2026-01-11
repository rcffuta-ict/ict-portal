import { Copyright } from "@/components/ui/copyright";
import { getActiveTenureName } from "@/utils/action";
import { RcfIctClient } from "@rcffuta/ict-lib";

export default async function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const tenureName = await getActiveTenureName();
    return (
        <>
            {children}

            <footer className="w-full text-center py-6">
                <div className="py-8 flex justify-center">
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
