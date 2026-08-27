"use client";

import { useActionState, useState } from "react";
import { createClTransaction, type ActionState } from "@/lib/actions/cl-transactions";
import { CL_CREATABLE_ROUTES, CARGO_TYPE_LABELS, CARGO_TYPES, ROUTE_LABELS_CL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BigCheckbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SealEditor, type SealDraft } from "@/components/seal-editor";
import type { CargoType, ClRoute } from "@/lib/database.types";

const initialState: ActionState = { error: null };

export function TransactionForm() {
  const [state, formAction, pending] = useActionState(createClTransaction, initialState);
  const [route, setRoute] = useState<ClRoute | "">("");
  const [searchDone, setSearchDone] = useState(false);
  const [seals, setSeals] = useState<SealDraft[]>([
    { seal_number: "", seal_type: "TRUCK_SEAL", seal_color: "" },
  ]);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);

  const toggleCargoType = (type: CargoType) => {
    setCargoTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const sealsReady = seals.length > 0 && seals.every((s) => s.seal_number.trim() !== "" && s.seal_color !== "");

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="route">Movement Type</Label>
            <Select id="route" name="route" value={route} onChange={(e) => setRoute(e.target.value as ClRoute)} required>
              <option value="" disabled>
                Select…
              </option>
              {CL_CREATABLE_ROUTES.map((r) => (
                <option key={r} value={r}>
                  {ROUTE_LABELS_CL[r]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Number</Label>
              <Input id="vehicle_number" name="vehicle_number" autoCapitalize="characters" required className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver_id">Driver ID</Label>
              <Input id="driver_id" name="driver_id" required className="font-mono" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="driver_name">Driver Name</Label>
              <Input id="driver_name" name="driver_name" required />
              <p className="text-xs text-muted-foreground">Must match the whitelisted name exactly.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cargo Type</Label>
            <div className="flex flex-wrap gap-2">
              {CARGO_TYPES.map((type) => {
                const checked = cargoTypes.includes(type);
                return (
                  <label
                    key={type}
                    className={
                      checked
                        ? "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-sm font-medium"
                        : "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-border px-3 py-2 text-sm font-medium hover:border-primary/40"
                    }
                  >
                    <input
                      type="checkbox"
                      name="cargo_types"
                      value={type}
                      checked={checked}
                      onChange={() => toggleCargoType(type)}
                      className="h-4 w-4 accent-primary"
                    />
                    {CARGO_TYPE_LABELS[type]}
                  </label>
                );
              })}
            </div>
            {cargoTypes.length === 0 ? <p className="text-xs text-muted-foreground">Select at least one.</p> : null}
          </div>

          <SealEditor seals={seals} onChange={setSeals} />
          <input type="hidden" name="seals" value={JSON.stringify(seals)} />

          <BigCheckbox
            id="vehicle_search_completed"
            name="vehicle_search_completed"
            label="Vehicle search completed"
            description="Cab, cargo area and undercarriage inspected before dispatch."
            checked={searchDone}
            onCheckedChange={setSearchDone}
            required
          />

          {state.error ? (
            <p role="alert" className="text-sm font-medium text-[#FB7185]">
              {state.error.replace(/^WHITELIST_VIOLATION:\s*/, "")}
            </p>
          ) : null}

          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={pending || !route || !searchDone || !sealsReady || cargoTypes.length === 0}
          >
            {pending ? "Creating…" : "Create Transaction & Generate QR"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
