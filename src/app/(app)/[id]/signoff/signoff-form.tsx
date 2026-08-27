"use client";

import { useActionState, useState } from "react";
import { signOffClTransaction, type ActionState } from "@/lib/actions/cl-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignatureField } from "@/components/signature-pad";

const initialState: ActionState = { error: null };

export function SignoffForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(signOffClTransaction, initialState);
  const [signature, setSignature] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="transaction_id" value={transactionId} />
          <SignatureField label="Your Signature" onChange={setSignature} />
          <input type="hidden" name="signature" value={signature ?? ""} />

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="xl" className="w-full" disabled={pending || !signature}>
            {pending ? "Signing off…" : "Sign Off & Complete"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
