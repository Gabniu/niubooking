// Ownership: authenticated transport operations route; legacy transport fixtures remain compatibility bridges.
import type { Metadata } from "next";
import { TransportOperationsPage } from "../../components/transport-operations-page.js";

export const metadata: Metadata = { title: "Transport operations" };

export default function TransportOperationsRoute() { return <TransportOperationsPage />; }
