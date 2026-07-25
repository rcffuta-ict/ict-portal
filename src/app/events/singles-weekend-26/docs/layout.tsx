import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Complete documentation for Agape '26 Singles Weekend. Learn about the attendee check-in flow, vendor coupon validation, and admin management.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
