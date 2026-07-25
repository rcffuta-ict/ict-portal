import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Portal",
  description: "Vendor coupon scanner for Agape '26 Singles Weekend. Scan and validate attendee shopping coupons.",
};

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
