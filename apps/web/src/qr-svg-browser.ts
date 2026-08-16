// Ownership: browser QR rendering adapter; the vendored encoder is loaded by Print Studio.

export interface BrowserQrSvgOptions { value: string; accent: string; logoRequested: boolean; }
type BrowserQrEncoder = { toString(value: string, options: { type: "svg"; errorCorrectionLevel: "H" | "M"; margin: number; color: { dark: string; light: string } }): Promise<string> };
declare const QRCode: BrowserQrEncoder;
const hexColor = /^#[0-9a-f]{6}$/i;
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = (channel: number) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return channels.reduce((sum, channel, index) => sum + [0.2126, 0.7152, 0.0722][index]! * linear(channel), 0);
}
export async function generateBrowserPrintQrSvg(options: BrowserQrSvgOptions): Promise<string> {
  if (!options.value.startsWith("https://")) throw new Error("QR values must use HTTPS");
  if (!hexColor.test(options.accent)) throw new Error("Accent must be a six-digit hex color");
  if (luminance(options.accent) > 0.45) throw new Error("Accent does not provide enough contrast");
  return QRCode.toString(options.value, { type: "svg", errorCorrectionLevel: options.logoRequested ? "H" : "M", margin: 4, color: { dark: options.accent, light: "#FFFFFF" } });
}
