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

  if (!res.ok) {
    let message = `VECTA QR mint failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { qrToken?: string };
  if (!data.qrToken) {
    throw new Error("VECTA QR mint returned no token.");
  }
  return data.qrToken;
}
