import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check-In",
  description: "Attendee check-in for Agape '26 Singles Weekend. Verify your registration and get your shopping coupon.",
};

export default function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
