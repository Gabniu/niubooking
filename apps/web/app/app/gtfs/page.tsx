import type { Metadata } from "next";
import { GtfsPublicationPage } from "../../components/gtfs-publication-page.js";

export const metadata: Metadata = { title: "Transit publication" };

export default function Page() {
  return <GtfsPublicationPage />;
}
