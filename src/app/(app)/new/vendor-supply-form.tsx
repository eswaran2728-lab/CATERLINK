"use client";

import { useActionState, useState } from "react";
import { createVendorTransaction, type ActionState } from "@/lib/actions/vendor-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignatureField } from "@/components/signature-pad";

const initialState: ActionState = { error: null };

export function VendorSupplyForm() {
  const [state, formAction, pending] = useActionState(createVendorTransaction, initialState);
  const [driverName, setDriverName] = useState("");
  const [nricNumber, setNricNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  const ready = Boolean(driverName && nricNumber && sealNumber && signature);

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="driver_name">Name of Driver</Label>
            <Input id="driver_name" name="driver_name" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nric_number">NRIC Number</Label>
            <Input
              id="nric_number"
              name="nric_number"
              className="font-mono"
              value={nricNumber}
              onChange={(e) => setNricNumber(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seal_number">Seal Number</Label>
            <Input
              id="seal_number"
              name="seal_number"
              className="font-mono"
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              required
            />
          </div>

          <SignatureField label="Signature" onChange={setSignature} />
          <input type="hidden" name="signature" value={signature ?? ""} />
          <p className="-mt-3 text-xs text-muted-foreground">
            Time/date is recorded automatically at submission — no need to enter it.
          </p>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-[#FB7185]">
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
