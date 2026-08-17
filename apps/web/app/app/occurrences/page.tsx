// Ownership: Next staff occurrences route; legacy HTML remains a compatibility surface.
import type { Metadata } from "next";
import { OccurrencesPage } from "../../components/occurrences-page.js";

export const metadata: Metadata = { title: "Occurrences" };

export default function OccurrencesRoute() { return <OccurrencesPage />; }
