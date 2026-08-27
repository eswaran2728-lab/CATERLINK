"use client";

import { useActionState, useState } from "react";
import { createVendorSupplyTransaction, type ActionState } from "@/lib/actions/cl-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null };

export function VendorSupplyForm() {
  const [state, formAction, pending] = useActionState(createVendorSupplyTransaction, initialState);
  const [ready, setReady] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={formAction}
          onChange={(e) => {
            const form = e.currentTarget;
            setReady(
              Boolean(
                (form.elements.namedItem("driver_name") as HTMLInputElement)?.value &&
                  (form.elements.namedItem("nric_number") as HTMLInputElement)?.value &&
                  (form.elements.namedItem("seal_number") as HTMLInputElement)?.value
              )
            );
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="driver_name">Driver Name</Label>
            <Input id="driver_name" name="driver_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nric_number">NRIC Number</Label>
            <Input id="nric_number" name="nric_number" className="font-mono" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seal_number">Seal Number</Label>
            <Input id="seal_number" name="seal_number" className="font-mono" required />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="xl" className="w-full" disabled={pending || !ready}>
            {pending ? "Creating…" : "Create Delivery & Generate QR"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
