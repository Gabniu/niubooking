// Ownership: public single-purpose contact verification route; challenge values are opaque.
import type { Metadata } from "next";
import { ContactVerificationPage } from "../../components/contact-verification-page.js";

export const metadata: Metadata = { title: "Verify contact" };

export default async function VerifyContactRoute({ params }: { params: Promise<{ challenge: string }> }) {
  const { challenge } = await params;
  return <ContactVerificationPage challenge={challenge} />;
}
