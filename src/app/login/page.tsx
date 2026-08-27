import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — CaterLink" };
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  "no-profile": "Your account is not set up yet. Contact your administrator.",
  pending: "Your registration is awaiting approval from a VECTA admin.",
  rejected: "Your registration was not approved. Contact your administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(89,128,166,0.10), transparent 60%)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="relative mb-10 flex flex-col items-center gap-4">
          <div
            className="pointer-events-none absolute inset-x-0 -top-8 h-72"
            style={{ background: "radial-gradient(circle at 50% 0%, rgba(245,166,35,0.10), transparent 70%)" }}
          />
          <div className="relative flex items-center gap-3.5">
            <Image
              src="/airasia-logo.png"
              alt="AirAsia"
              width={64}
              height={66}
              className="rounded-full object-cover ring-1 ring-white/10"
            />
            <div className="h-8 w-px bg-white/10" />
            <Image src="/avsec-logo.png" alt="AVSEC" width={72} height={68} className="object-contain" />
          </div>
          <div className="relative text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">CaterLink</h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Driver Movement
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.1)] p-3 text-center text-sm font-medium text-[#FB7185]"
          >
            {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
          </p>
        ) : null}

        <LoginForm />

        <p className="mt-5 text-center text-[12.5px] text-muted-foreground">
          New vendor driver?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Register your account
          </Link>
        </p>

        <p className="mt-8 text-center text-[10.5px] tracking-wide text-[#3A4459]">
          AirAsia-provisioned access · Shared backend with VECTA
        </p>
      </div>
    </div>
  );
}
