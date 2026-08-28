"use client";

import { useActionState, useState } from "react";
import { cancelClTransaction, type ActionState } from "@/lib/actions/cl-transactions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { error: null };

export function CancelForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(cancelClTransaction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancel Transaction
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="transaction_id" value={transactionId} />
      <Label htmlFor="reason">Reason for cancellation</Label>
      <Textarea id="reason" name="reason" required placeholder="e.g. Vehicle search failed — cargo area not clean" />
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-[#FB7185]">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Cancelling…" : "Confirm Cancellation"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Back
        </Button>
      </div>
    </form>
  );
}
