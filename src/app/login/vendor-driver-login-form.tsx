"use client";

import { useActionState } from "react";
import { loginVendorDriver, type ActionState } from "@/lib/actions/vendor-driver-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null };

export function VendorDriverLoginForm() {
  const [state, formAction, pending] = useActionState(loginVendorDriver, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="driver_code">Driver Code</Label>
        <Input
          id="driver_code"
          name="driver_code"
          placeholder="V-0001"
          className="font-mono uppercase"
          autoCapitalize="characters"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">4-Digit PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          className="font-mono tracking-[0.5em]"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
