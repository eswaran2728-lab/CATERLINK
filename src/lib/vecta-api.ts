import "server-only";

/**
 * VECTA holds the signing secret for QR passes — CaterLink cannot mint
 * its own (see the CaterLink<->VECTA Forms Integration Contract). After
 * inserting a transactions/vendor_transactions row, call this to get the
 * signed, tamper-proof token to display as the QR pass. The endpoint is
 * idempotent — safe to call again for the same transaction.
 *
 * Requires VECTA_API_BASE_URL (server-only env var — VECTA's production
 * domain). Auth is an ownership check: the caller must be the same
 * Supabase-authenticated identity as the row's created_by.
 */
export async function mintQrToken(params: {
  transactionId: string;
  type: "CATERING" | "VENDOR";
  accessToken: string;
}): Promise<string> {
  const baseUrl = process.env.VECTA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("VECTA_API_BASE_URL is not configured — cannot mint a QR pass. Contact your administrator.");
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/icms/qr/mint`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({ transactionId: params.transactionId, type: params.type }),
    });
  } catch {
    throw new Error("Could not reach VECTA to mint the QR pass. Check your connection and try again.");
  }

  const contentType = res.headers.get("content-type") ?? "";
  const rawBody = await res.text();

  if (!contentType.includes("application/json")) {
    // A non-JSON response (almost always HTML) here — even on a 200 — is
    // the signature of Vercel Deployment Protection intercepting the
    // request with an auth-challenge page before it ever reaches VECTA's
    // actual API route, not an application-level error.
    throw new Error(
      `VECTA returned a non-JSON response (HTTP ${res.status}) instead of the QR token. ` +
        "This usually means Vercel Deployment Protection is enabled on VECTA's project and is blocking " +
        "server-to-server calls with an authentication page. Ask whoever manages VECTA's Vercel project to " +
        "either disable protection for /api/icms/qr/mint or issue a Protection Bypass for Automation secret."
    );
  }

  let body: { error?: string; qrToken?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(`VECTA returned malformed JSON (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(body.error ?? `VECTA QR mint failed (HTTP ${res.status})`);
  }
  if (!body.qrToken) {
    throw new Error("VECTA QR mint returned no token.");
  }
  return body.qrToken;
}
