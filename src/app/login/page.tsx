import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — CaterLink" };
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "Google sign-in failed. Please try again.",
  domain: "Only @airasia.com accounts can sign in as AirAsia Staff.",
  profile: "Could not set up your account. Contact your administrator.",
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
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight">CaterLink</h1>
          <p className="text-sm text-muted-foreground">Driver sign-in</p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          New driver?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
