// Ownership: Booking's branded sign-in experience; credentials and MFA stay with NIU Auth.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title"><p className="eyebrow">Niu Booking</p><h1 id="auth-title">Sign in to your workspace</h1><p>Use your NIU Auth account to access your authorized organizations and branches. Your password, recovery, and MFA stay with NIU Auth.</p><a className="primary-button" href="/auth/login">Continue with NIU Auth <span aria-hidden="true">→</span></a><p className="auth-help">Need access? Ask your organization administrator to invite you through NIU Auth.</p><a className="account-button" href="/">Return to Niu Booking</a></section></main>;
}
