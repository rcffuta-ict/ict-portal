import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Agape '26 - Singles Weekend",
    template: "%s | Agape '26",
  },
  description:
    "Agape 2026 - RCF FUTA Singles Weekend. A weekend designed for singles to grow in love, purpose, and community. February 14-15, 2026 at RCF FUTA Southgate Auditorium.",
  keywords: [
    "Agape 2026",
    "RCF FUTA",
    "Singles Weekend",
    "Christian Singles",
    "Valentine Event",
    "FUTA Fellowship",
    "RCF Singles",
  ],
  openGraph: {
    title: "Agape '26 - RCF FUTA Singles Weekend",
    description:
      "A weekend designed for singles to grow in love, purpose, and community. February 14-15, 2026.",
    type: "website",
    locale: "en_NG",
    siteName: "RCF FUTA ICT Portal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agape '26 - RCF FUTA Singles Weekend",
    description:
      "A weekend designed for singles to grow in love, purpose, and community. February 14-15, 2026.",
  },
};

export default function SinglesWeekendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
