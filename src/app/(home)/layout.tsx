import { GenericFooter } from "@/components/events/footer";

export default async function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {children}

            <GenericFooter/>
        </>
    );
}
