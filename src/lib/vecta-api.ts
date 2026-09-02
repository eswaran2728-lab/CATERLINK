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
  // Keep enough of the raw body to diagnose the real cause (status code +
  // a body snippet) rather than guessing at it — surfaced to the driver's
  // error message so it can be copied verbatim when reporting the issue.
  const snippet = rawBody.slice(0, 300);

  if (!contentType.includes("application/json")) {
    throw new Error(
      `VECTA returned HTTP ${res.status} with content-type "${contentType || "none"}" instead of JSON. ` +
        `Body: ${snippet}`
    );
  }

  let body: { error?: string; qrToken?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(`VECTA returned HTTP ${res.status} with unparseable JSON. Body: ${snippet}`);
  }

  if (!res.ok) {
    throw new Error(`VECTA QR mint failed (HTTP ${res.status}): ${body.error ?? snippet}`);
  }
  if (!body.qrToken) {
    throw new Error(`VECTA QR mint returned no token (HTTP ${res.status}). Body: ${snippet}`);
  }
  return body.qrToken;
}
