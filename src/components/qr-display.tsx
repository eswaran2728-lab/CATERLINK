"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrDisplayProps {
  /** VECTA-minted signed token (e.g. "CATERING.<uuid>.<expiry>.<hmac>"); expires after 24 hours. */
  token: string;
  transactionNumber: string;
  size?: number;
}

/**
 * Renders the transaction QR pass. The qrToken string from VECTA's mint
 * endpoint is encoded verbatim — no JSON wrapper — per the CaterLink<->VECTA
 * Forms Integration Contract; VECTA's Scan feature expects the raw string.
 *
 * The QR itself stays dark-modules-on-white — real scanners need that
 * contrast — and sits in a pale amber-tinted panel matching the rest of
 * the app.
 */
export function QrDisplay({ token, transactionNumber, size = 240 }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(token, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [token, size]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative overflow-hidden rounded-[18px] border p-4"
        style={{
          borderColor: "rgba(245,166,35,0.3)",
          background: "#FFFBF3",
          boxShadow: "0 0 32px rgba(245,166,35,0.12)",
        }}
      >
        {dataUrl ? (
          <div className="overflow-hidden rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={`QR code for ${transactionNumber}`} width={size} height={size} />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl bg-white text-sm text-gray-500"
            style={{ width: size, height: size }}
          >
            Generating QR…
          </div>
        )}
      </div>
      <p className="font-mono text-[17px] font-semibold tracking-wide text-foreground">{transactionNumber}</p>
      <button
        type="button"
        onClick={() => window.print()}
        className="text-xs text-primary underline print:hidden"
      >
        Print QR pass
      </button>
    </div>
  );
}
