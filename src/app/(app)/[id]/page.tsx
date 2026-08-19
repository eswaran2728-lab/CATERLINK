import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { IcmsStatus } from "./icms-status";
import { VendorStatus } from "./vendor-status";

export const metadata: Metadata = { title: "Delivery status — CaterLink" };
export const dynamic = "force-dynamic";

export default async function DeliveryStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  return profile.role === "driver_ifc" ? <IcmsStatus id={id} /> : <VendorStatus id={id} />;
}
