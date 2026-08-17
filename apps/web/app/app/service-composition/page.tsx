import type { Metadata } from "next";
import { ServiceCompositionPage } from "../../components/service-composition-page.js";

export const metadata: Metadata = { title: "Service composition" };

export default function Page() {
  return <ServiceCompositionPage />;
}
