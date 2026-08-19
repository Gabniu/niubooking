import type { Metadata } from "next";
import { TransportPublicPage } from "../../components/transport-public-page.js";

export const metadata: Metadata = { title: "Choose your trip" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/u, "");
  return <TransportPublicPage code={code} apiBase={apiBase} />;
}
