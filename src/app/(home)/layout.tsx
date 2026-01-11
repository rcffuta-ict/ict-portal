import { Copyright } from "@/components/ui/copyright";
import { RcfIctClient } from "@rcffuta/ict-lib";

async function getActiveTenureName() {
    const rcf = RcfIctClient.fromEnv();

    try {
        const { data } = await rcf.supabase
            .from("tenures")
            .select("name")
            .eq("is_active", true)
            .single();

        return data?.name || null;
    } catch (error) {
        return null; // Fallback if no tenure exists
    }
}

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
