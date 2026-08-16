// Ownership: safe Print Studio view-models. Rendering/export adapters consume these typed constraints.

export type PrintTemplate = "table-tent" | "sticker" | "a5-flyer" | "a4-poster";
export type PrintVariant = "hero" | "split" | "classic";

export interface PrintSpec {
  template: PrintTemplate;
  variant: PrintVariant;
  headline: string;
  callToAction: string;
  businessLabel: string;
  accent: string;
  logoUrl: string | null;
}

export interface PrintPreviewModel {
  spec: PrintSpec;
  qrValue: string;
  scanSafe: boolean;
  diagnostics: readonly string[];
}

const safeAccent = /^#[0-9a-f]{6}$/i;
const templateSizes: Record<PrintTemplate, string> = { "table-tent": "A6 folded", sticker: "70mm circle", "a5-flyer": "A5", "a4-poster": "A4" };

export function createPrintPreview(spec: PrintSpec, publicCode: string, baseUrl: string): PrintPreviewModel {
  const diagnostics: string[] = [];
  if (!safeAccent.test(spec.accent)) diagnostics.push("Choose a six-digit accent color.");
  if (!spec.headline.trim()) diagnostics.push("Add a headline before printing.");
  if (!spec.callToAction.trim()) diagnostics.push("Add a call to action before printing.");
  if (!/^https?:\/\//.test(baseUrl)) diagnostics.push("Use an HTTPS booking base URL.");
  if (spec.logoUrl) diagnostics.push("Logo overlay requires high error correction and a scan test.");
  diagnostics.push(`Print size: ${templateSizes[spec.template]}. Quiet zone: at least 4mm.`);
  return { spec, qrValue: `${baseUrl.replace(/\/$/, "")}/book/${encodeURIComponent(publicCode)}`, scanSafe: diagnostics.length === 1 && !spec.logoUrl, diagnostics };
}
