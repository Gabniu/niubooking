// Ownership: stable advisory availability response contract.

export interface RequirementAvailabilityResponse {
  data: { slots: readonly { startsAt: string; endsAt: string; assignments: readonly { requirementId: string; resourceIds: readonly string[]; requirementLabel?: string }[] }[]; rejected: readonly { requirementId: string; reason: string }[] } | null;
  error: { code: string; message: string } | null;
}
