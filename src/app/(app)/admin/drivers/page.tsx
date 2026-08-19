import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VendorDriver } from "@/lib/database.types";
import { CreateDriverForm } from "./create-driver-form";
import { ToggleActiveButton } from "./toggle-active-button";

export const metadata: Metadata = { title: "Drivers — CaterLink" };
export const dynamic = "force-dynamic";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const profile = await requireRole(["vendor"]);

  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_drivers")
    .select("*")
    .eq("vendor_id", profile.id)
    .order("created_at", { ascending: false });
  const drivers = (data ?? []) as VendorDriver[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
        <p className="text-sm text-muted-foreground">
          Manage your company&apos;s vendor drivers and their Driver Code + PIN logins.
        </p>
      </div>

      {created ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Driver created — Driver Code <span className="font-mono">{created}</span>. Share the
          Driver Code and the PIN you set with the driver out of band (e.g. WhatsApp).
        </p>
      ) : null}

      <CreateDriverForm />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Vehicle Plate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No drivers yet.
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-medium">{d.driver_code}</TableCell>
                  <TableCell>{d.full_name}</TableCell>
                  <TableCell className="font-mono text-xs">{d.vehicle_plate ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        d.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }
                    >
                      {d.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ToggleActiveButton driverId={d.id} isActive={d.is_active} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
