import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Lo! | RCF FUTA",
    description:
        "Behold! Ask questions, discover events, and engage with the RCF FUTA community.",
};

export default function LoAppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
