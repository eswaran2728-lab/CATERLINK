"use client";

import { useActionState } from "react";
import { createVendorDriver, type ActionState } from "@/lib/actions/pin-driver-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null };

export function CreateDriverForm() {
  const [state, formAction, pending] = useActionState(createVendorDriver, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a driver</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ic_number">IC Number</Label>
              <Input id="ic_number" name="ic_number" className="font-mono" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_plate">Vehicle Plate (optional)</Label>
              <Input id="vehicle_plate" name="vehicle_plate" className="font-mono uppercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">Set 4-Digit PIN</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                className="font-mono"
                required
              />
            </div>
          </div>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Driver"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
