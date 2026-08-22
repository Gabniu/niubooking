// Ownership: user-facing schedule labels; opaque identifiers stay inside action contracts.

export function customerDisplayName(customerId: string, names: Readonly<Record<string, string>>): string {
  return names[customerId]?.trim() || "Customer name unavailable";
}
