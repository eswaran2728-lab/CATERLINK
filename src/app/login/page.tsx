import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginTabs } from "./login-tabs";

export const metadata: Metadata = { title: "Sign in — CaterLink" };
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "Google sign-in failed. Please try again.",
  domain: "Only @airasia.com accounts can sign in as AirAsia Staff.",
  profile: "Could not set up your account. Contact your administrator.",
  "no-profile": "Your account is not set up yet. Contact your administrator.",
  pending: "Your account is awaiting approval.",
  rejected: "Your account was not approved. Contact your administrator.",
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
          <p className="text-sm text-muted-foreground">Driver sign-in — Vendor Movement Module</p>
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
            <LoginTabs />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
