import type { Metadata } from "next";
import { PackSettingsPage } from "../../components/pack-settings-page.js";

export const metadata: Metadata = { title: "Pack settings" };

export default function Page() {
  return <PackSettingsPage />;
}
