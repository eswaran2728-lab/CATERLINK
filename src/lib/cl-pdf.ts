import "server-only";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { ROUTE_LABELS_CL } from "@/lib/constants";
import type { ClRoute, ClSeal } from "@/lib/database.types";

interface GenerateCompletionPdfInput {
  referenceNumber: string;
  route: ClRoute;
  vehicleNumber: string;
  driverName: string;
  driverId: string | null;
  seals: ClSeal[];
  signerName: string;
  signerRole: string;
  signaturePath: string;
  signedAt: string;
}

/**
 * Simple, self-contained completion PDF — not an overlay on AirAsia's
 * official IFCSF template (that template image is icms-airasia's own
 * asset). Written fresh with pdf-lib, a generic PDF library.
 */
export async function generateClCompletionPdf(input: GenerateCompletionPdfInput): Promise<Buffer> {
  const supabase = await createClient();
  const { data: sigFile } = await supabase.storage.from("signatures").download(input.signaturePath);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 792;
  const line = (text: string, size = 11, useFont = font) => {
    page.drawText(text, { x: 50, y, size, font: useFont });
    y -= size + 10;
  };

  line("CaterLink — Transaction Completion", 18, bold);
  y -= 8;
  line(`Reference: ${input.referenceNumber}`);
  line(`Route: ${ROUTE_LABELS_CL[input.route]}`);
  line(`Vehicle: ${input.vehicleNumber}`);
  line(`Driver: ${input.driverName}${input.driverId ? ` (${input.driverId})` : ""}`);
  y -= 8;

  if (input.seals.length > 0) {
    line("Seals", 13, bold);
    for (const s of input.seals) {
      line(`  ${s.seal_type} — ${s.seal_number} (${s.seal_color})`);
    }
    y -= 8;
  }

  line("Signed off", 13, bold);
  line(`${input.signerName} (${input.signerRole})`);
  line(`At: ${new Date(input.signedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })}`);

  if (sigFile) {
    try {
      const bytes = new Uint8Array(await sigFile.arrayBuffer());
      const image = await pdfDoc.embedPng(bytes);
      const dims = image.scale(0.35);
      y -= dims.height + 10;
      page.drawImage(image, { x: 50, y, width: dims.width, height: dims.height });
    } catch {
      // Signature image couldn't be embedded — the PDF still has every
      // other completion detail, so this is not fatal.
    }
  }

  return Buffer.from(await pdfDoc.save());
}
