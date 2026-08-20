"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setVendorDriverActive } from "@/lib/actions/pin-driver-auth";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({ driverId, isActive }: { driverId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setVendorDriverActive(driverId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
