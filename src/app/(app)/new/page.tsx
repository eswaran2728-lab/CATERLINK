import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VendorPartAForm } from "./vendor-part-a-form";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "New Delivery — CaterLink" };
export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const profile = await requireProfile();
  if (profile.role !== "driver_ifc" && profile.role !== "driver_vendor") {
    redirect("/login?error=no-profile");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">New Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details and sign. A reference number and QR pass are generated on submit —
          show it to AVSEC next.
        </p>
      </div>
      {profile.role === "driver_ifc" ? (
        <TransactionForm driverName={profile.name} driverStaffId={profile.staff_id} />
      ) : (
        <VendorPartAForm />
      )}
    </div>
  );
}
