// Ownership: same-origin callback relay; only the one-time OIDC query reaches the API.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = process.env.BOOKING_API_ORIGIN?.replace(/\/$/u, "");
  if (!origin) return Response.json({ data: null, error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable." } }, { status: 503 });
  const query = new URL(request.url).search;
  try {
    const upstream = await fetch(`${origin}/auth/callback${query}`, { cache: "no-store", redirect: "manual" });
    const headers = new Headers();
    const location = upstream.headers.get("location"); const cookie = upstream.headers.get("set-cookie");
    if (location) headers.set("location", location); if (cookie) headers.set("set-cookie", cookie);
    if (upstream.status >= 300 && upstream.status < 400) return new Response(null, { status: upstream.status, headers });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch { return Response.json({ data: null, error: { code: "AUTH_UNAVAILABLE", message: "Sign-in could not be completed. Please try again." } }, { status: 503 }); }
}
