// Ownership: public Niu Booking product entry; it never loads tenant data.
import type { Metadata } from "next";
import { PublicHome } from "./components/public-home.js";

export const metadata: Metadata = { title: "Service work, made clear" };

export default function HomePage() {
  return <PublicHome />;
}
