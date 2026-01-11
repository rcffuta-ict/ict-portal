import { Copyright } from "@/components/ui/copyright";

export default function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {children}

            <footer className="w-full text-center py-6">
                <div className="py-8 flex justify-center">
                    <Copyright
                        tenure="The Rebranding Tenure"
                        variant="dark"
                        className="text-center"
                    />
                </div>
            </footer>
        </>
    );
}
