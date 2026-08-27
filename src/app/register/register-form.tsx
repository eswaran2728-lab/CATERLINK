"use client";

import { useActionState } from "react";
import { registerStaff, type RegisterState } from "@/lib/actions/registration";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/database.types";

const initialState: RegisterState = { error: null, success: null };

const REGISTERABLE_ROLES: Role[] = ["driver_ifc", "driver_vendor"];

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerStaff, initialState);

  if (state.success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{state.success}</p>
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
            <Label htmlFor="reg-staff-id">Staff / Driver ID</Label>
            <Input id="reg-staff-id" name="staff_id" required className="font-mono" />
            <p className="text-xs text-muted-foreground">
              IFC drivers: use your ICMS whitelist staff ID. Vendor drivers: any ID your company uses.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <Input id="reg-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-role">I am a…</Label>
            <Select id="reg-role" name="role" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {REGISTERABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
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
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
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
