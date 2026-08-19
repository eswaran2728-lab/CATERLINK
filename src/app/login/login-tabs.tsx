"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GoogleSignInButton } from "./google-signin-button";
import { VendorDriverLoginForm } from "./vendor-driver-login-form";

type Tab = "ifc" | "vendor";

export function LoginTabs() {
  const [tab, setTab] = useState<Tab>("ifc");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 rounded-lg border p-1">
        <button
          type="button"
          onClick={() => setTab("ifc")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "ifc"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          AirAsia Staff
        </button>
        <button
          type="button"
          onClick={() => setTab("vendor")}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "vendor"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Vendor Driver
        </button>
      </div>

      {tab === "ifc" ? <GoogleSignInButton /> : <VendorDriverLoginForm />}
    </div>
  );
}
