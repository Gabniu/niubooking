// Ownership: privacy-preserving feedback analytics. Aggregates never expose individual responses.

export interface FeedbackAnalytics {
  campaignId: string;
  templateVersion: number;
  responseCount: number;
  averageRating: number | null;
  ratingCount: number;
  choiceCounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export function aggregateFeedback(campaignId: string, templateVersion: number, responses: readonly { answers: Readonly<Record<string, string | number>> }[]): FeedbackAnalytics {
  let ratingTotal = 0;
  let ratingCount = 0;
  const choiceCounts: Record<string, Record<string, number>> = {};
  for (const response of responses) {
    for (const [questionId, answer] of Object.entries(response.answers)) {
      if (typeof answer === "number" && answer >= 1 && answer <= 5) { ratingTotal += answer; ratingCount += 1; }
      if (typeof answer === "string") { const counts = choiceCounts[questionId] ?? (choiceCounts[questionId] = {}); counts[answer] = (counts[answer] ?? 0) + 1; }
    }
  }
  return { campaignId, templateVersion, responseCount: responses.length, averageRating: ratingCount ? Number((ratingTotal / ratingCount).toFixed(2)) : null, ratingCount, choiceCounts };
}
