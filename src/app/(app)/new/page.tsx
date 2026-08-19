import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { VendorPartAForm } from "./vendor-part-a-form";

export const metadata: Metadata = { title: "New Delivery — CaterLink" };
export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  await requireRole(["driver_ifc", "driver_vendor"]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">New Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Part A — enter your details and sign. A reference number and QR pass are generated on
          submit; show the QR code to AVSEC next.
        </p>
      </div>
      <VendorPartAForm />
    </div>
  );
}
