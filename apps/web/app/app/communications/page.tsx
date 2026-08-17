import type { Metadata } from "next";
import { CommunicationsPage } from "../../components/communications-page.js";

export const metadata: Metadata = { title: "Communications" };

export default function Page() {
  return <CommunicationsPage />;
}
