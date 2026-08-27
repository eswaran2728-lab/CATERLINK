import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register — CaterLink" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">CaterLink</h1>
          <p className="text-sm text-muted-foreground">Vendor driver registration</p>
          <p className="text-xs text-muted-foreground">
            AirAsia/VECTA staff: sign in directly with your existing VECTA account instead.
          </p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
