// Ownership: Next staff service catalog route; legacy HTML remains a compatibility surface.
import type { Metadata } from "next";
import { ServicesPage } from "../../components/services-page.js";

export const metadata: Metadata = { title: "Services" };

export default function ServicesRoute() { return <ServicesPage />; }
