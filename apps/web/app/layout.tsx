// Ownership: shared Next document metadata and global Booking styles.
import type { Metadata } from "next";
import "./globals.css";
import "./pack-catalog.css";
import "./schedule.css";
import "./customers.css";
import "./services.css";
import "./resources.css";

export const metadata: Metadata = {
  title: { default: "Niu Booking", template: "%s — Niu Booking" },
  description: "A clear, dependable home for service operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
