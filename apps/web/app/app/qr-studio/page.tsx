import type { Metadata } from "next";
import { QrStudioPage } from "../../components/qr-studio-page.js";

export const metadata: Metadata = { title: "QR Print Studio" };

export default function Page() {
  return <QrStudioPage />;
}
