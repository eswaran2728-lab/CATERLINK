import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { TransactionForm } from "./transaction-form";
import { VendorSupplyForm } from "./vendor-supply-form";

export const metadata: Metadata = { title: "New Delivery — CaterLink" };
export const dynamic = "force-dynamic";

export default async function NewDeliveryPage() {
  const profile = await requireProfile();
  if (profile.role !== "warehouse_pic" && profile.role !== "vendor") {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">New Delivery</h1>
        <p className="text-sm text-muted-foreground">
          A reference number and QR pass are generated on submit — VECTA handles everything from
          checkpoint scanning through completion from here.
        </p>
      </div>
      {profile.role === "warehouse_pic" ? (
        <TransactionForm picName={profile.name} picStaffId={profile.staff_id} />
      ) : (
        <VendorSupplyForm />
      )}
    </div>
  );
}
