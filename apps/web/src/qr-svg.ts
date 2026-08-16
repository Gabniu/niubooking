// Ownership: print-safe QR SVG generation. Branding is constrained so the quiet zone and contrast remain intact.

import QRCode from "qrcode";

export interface QrSvgOptions {
  value: string;
  accent: string;
  logoRequested: boolean;
}

const hexColor = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const red = channels[0] ?? 0;
  const green = channels[1] ?? 0;
  const blue = channels[2] ?? 0;
  const linear = (channel: number) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export async function generatePrintQrSvg(options: QrSvgOptions): Promise<string> {
  if (!options.value.startsWith("https://")) throw new Error("QR values must use HTTPS");
  if (!hexColor.test(options.accent)) throw new Error("Accent must be a six-digit hex color");
  if (luminance(options.accent) > 0.45) throw new Error("Accent does not provide enough contrast");
  const svg = await QRCode.toString(options.value, { type: "svg", errorCorrectionLevel: options.logoRequested ? "H" : "M", margin: 4, color: { dark: options.accent, light: "#FFFFFF" } });
  return svg;
}
