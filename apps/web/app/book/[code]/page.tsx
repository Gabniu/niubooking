import type { Metadata } from "next";
import { GuestBookingPage } from "../../components/guest-booking-page.js";

export const metadata: Metadata = { title: "Reserve a time" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GuestBookingPage code={code} />;
}
