// Ownership: public occurrence reservation route; only the opaque QR code crosses the boundary.
import type { Metadata } from "next";
import { PublicOccurrencePage } from "../../components/public-occurrence-page.js";

export const metadata: Metadata = { title: "Reserve a place" };

export default async function PublicOccurrenceRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PublicOccurrencePage code={code} />;
}
