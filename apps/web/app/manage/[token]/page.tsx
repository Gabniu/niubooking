import type { Metadata } from "next";
import { ManageBookingPage } from "../../components/manage-booking-page.js";

export const metadata: Metadata = { title: "Manage booking" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ManageBookingPage token={token} />;
}
