import type { Metadata } from "next";
import { TransportTicketPage } from "../../components/transport-ticket-page.js";

export const metadata: Metadata = { title: "Your travel ticket" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/u, "");
  return <TransportTicketPage token={token} apiBase={apiBase} />;
}
