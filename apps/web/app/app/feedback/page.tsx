import type { Metadata } from "next";
import { FeedbackPage } from "../../components/feedback-page.js";

export const metadata: Metadata = { title: "Feedback" };

export default function Page() {
  return <FeedbackPage />;
}
