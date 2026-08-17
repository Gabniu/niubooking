// Ownership: public capability-bound feedback route; it never accepts tenant identity from the URL.
import type { Metadata } from "next";
import { FeedbackExperience } from "../../components/feedback-experience.js";

export const metadata: Metadata = { title: "Share your feedback" };

export default async function PublicFeedbackPage({ params }: { params: Promise<{ capability: string }> }) {
  const { capability } = await params;
  return <FeedbackExperience capability={capability} />;
}
