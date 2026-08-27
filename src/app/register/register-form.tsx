"use client";

import { useActionState } from "react";
import { registerStaff, type RegisterState } from "@/lib/actions/registration";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RegisterState = { error: null, success: null };

/**
 * Vendor driver registration only — every other CaterLink role already
 * has a VECTA account and signs in directly (see registration.ts).
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerStaff, initialState);

  if (state.success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-[#34D399]">{state.success}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-name">Full Name</Label>
            <Input id="reg-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-staff-id">Driver ID</Label>
            <Input id="reg-staff-id" name="staff_id" required className="font-mono" />
            <p className="text-xs text-muted-foreground">Any ID your company uses to identify you.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input id="reg-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-[#FB7185]">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="xl" className="w-full" disabled={pending}>
            {pending ? "Submitting…" : "Submit registration"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
