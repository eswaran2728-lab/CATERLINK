import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * CaterLink v2's own signed QR pass token — written fresh, independent
 * of icms-airasia's qr-token.ts (different secret env var
 * CATERLINK_QR_SECRET, deliberately not QR_TOKEN_SECRET, since that
 * format was never agreed with VECTA's team). See
 * docs/qr-payload-proposal.md for the provisional format handed to
 * VECTA — this file is not "live" cross-system until they confirm it
 * and their scanner is updated to look up cl_transactions by the
 * decoded id.
 *
 * Format: CL.<transactionId>.<expiryUnixSeconds>.<hmacBase64Url>
 * Signature: HMAC-SHA256 over "CL.<transactionId>.<expiry>".
 */

const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.CATERLINK_QR_SECRET;
  if (!s || s.length < 32) {
    throw new Error("CATERLINK_QR_SECRET is not configured");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function generateClQrToken(transactionId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `CL.${transactionId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export type ClQrTokenResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string };

export function verifyClQrToken(token: string): ClQrTokenResult {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "CL") {
    return { ok: false, error: "Invalid QR pass." };
  }
  const [, tid, expRaw, sig] = parts;
  if (!UUID_RE.test(tid) || !/^\d+$/.test(expRaw)) {
    return { ok: false, error: "Invalid QR pass." };
  }

  const expected = sign(`CL.${tid}.${expRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "QR pass signature is invalid — possible forgery." };
  }

  if (parseInt(expRaw, 10) < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "QR pass has expired (24 hour limit)." };
  }

  return { ok: true, transactionId: tid };
}
