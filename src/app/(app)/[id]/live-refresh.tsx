"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Realtime changes on this delivery so the driver sees
 * downstream checkpoints land live. `tables[0]` is filtered by its own
 * `id`; the rest are filtered by `transaction_id` — matching how the
 * transaction row itself vs. its part_b/c/d (or vendor_part_b/c) rows
 * reference the transaction.
 */
export function LiveRefresh({ transactionId, tables }: { transactionId: string; tables: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`transaction-${transactionId}`);

    tables.forEach((table, i) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${i === 0 ? "id" : "transaction_id"}=eq.${transactionId}`,
        },
        () => router.refresh()
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transactionId, tables, router]);

  return null;
}
