// Ownership: Next staff customer-profile route; legacy HTML remains a compatibility surface.
import type { Metadata } from "next";
import { CustomersPage } from "../../components/customers-page.js";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersRoute() { return <CustomersPage />; }
