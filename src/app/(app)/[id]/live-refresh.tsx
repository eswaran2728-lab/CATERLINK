"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to Realtime changes on this delivery so the driver sees Part B/C land live. */
export function LiveRefresh({ transactionId }: { transactionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`vendor-transaction-${transactionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_transactions", filter: `id=eq.${transactionId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_part_b", filter: `transaction_id=eq.${transactionId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_part_c", filter: `transaction_id=eq.${transactionId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, router]);

  return null;
}
