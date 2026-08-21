# Booking login setup

Booking already contains the login code. One Auth administrator action is still
required before real login can work: register Booking as an application in the
shared NOVA Auth service.

## 1. Register Booking

Open:

`https://novaauth.niuautomations.com/admin/apps`

Sign in with your NOVA Auth administrator account, then choose **Register app**.
Use these values:

| Field | Value |
|---|---|
| Application name | `NIU Booking` |
| Redirect URI | `https://booking.niuautomations.com/auth/callback` |
| Client type | `Public mobile/browser client` |

The redirect URI must match exactly. Do not add a slash, change `https` to
`http`, or use a wildcard.

Copy the **Client ID** after the application is created. Do not send or store a
client secret for this Booking flow; it uses PKCE.

## 2. Configure the Booking deployment

The Booking server environment must contain:

```env
AUTH_ISSUER=https://novaauth.niuautomations.com/api/auth
AUTH_CLIENT_ID=<the-client-id-from-step-1>
AUTH_REDIRECT_URI=https://booking.niuautomations.com/auth/callback
# Optional: audience issued to native NIU Driver access tokens.
# AUTH_ACCESS_TOKEN_AUDIENCE=<registered-booking-api-audience>

Native clients use a separately registered public OAuth client with authorization
code + PKCE and an approved app/universal-link redirect. They send the resulting
access token as `Authorization: Bearer ...` to Booking; they do not use the web
callback cookie or the one-time fleet device credential as identity.
```

These values belong in the server's private `.env`, never in Git, the web
bundle, or the CI log. They are now configured on the isolated Booking staging
deployment; the local `.env` remains ignored as well.

## 3. Map the first Booking user

After the first successful Auth login, Booking still checks its own database.
The user's NOVA identity subject must have an exact local mapping containing:

- the Auth issuer: `https://novaauth.niuautomations.com/api/auth`
- the user's `sub` claim from the verified ID token
- the Booking local user and active tenant membership

An email address alone is not enough. Booking never auto-creates a user or
uses an email fallback for tenant access.

## 4. Verify

Once the client ID is available and Booking is deployed:

1. Open Booking and select **Sign in**.
2. Confirm the browser goes to NOVA Auth.
3. Complete login and confirm the browser returns to Booking.
4. Confirm `/auth/session` reports an authenticated session.
5. Confirm a user without a local mapping is denied without revealing tenant
   data.
6. Sign out and confirm the session is revoked.

The local automated suite already covers PKCE, state, nonce, issuer, audience,
JWKS, expiry, exact mapping, logout, and replay protection. The public staging
URL is now ready for the final real-provider callback check.
