// Ownership: Next staff resource inventory route; legacy HTML remains a compatibility surface.
import type { Metadata } from "next";
import { ResourcesPage } from "../../components/resources-page.js";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesRoute() { return <ResourcesPage />; }
