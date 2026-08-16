// Ownership: universal customer subject. Industry packs specialize labels and fields above this stable identity.

export type CustomerStatus = "active" | "archived";

export interface CustomerProfile {
  id: string;
  tenantId: string;
  displayName: string;
  preferredLocale: string | null;
  timezone: string | null;
  status: CustomerStatus;
}
