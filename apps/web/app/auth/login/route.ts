// Ownership: same-origin handoff from the branded page to Booking's server OIDC start route.
export const dynamic = "force-dynamic";

export async function GET() {
  const origin = process.env.BOOKING_API_ORIGIN?.replace(/\/$/u, "");
  if (!origin) return Response.json({ data: null, error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable." } }, { status: 503 });
  try {
    const upstream = await fetch(`${origin}/auth/login`, { cache: "no-store", redirect: "manual" });
    if (upstream.status < 300 || upstream.status >= 400) return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
    return new Response(null, { status: upstream.status, headers: { location: upstream.headers.get("location") ?? "/auth/sign-in" } });
  } catch { return Response.json({ data: null, error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable." } }, { status: 503 }); }
}
