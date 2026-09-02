"use client";

import { useActionState, useState } from "react";
import { createClTransaction, type ActionState } from "@/lib/actions/cl-transactions";
import { CL_CREATABLE_ROUTES, CARGO_TYPE_LABELS, CARGO_TYPES, ROUTE_LABELS_CL } from "@/lib/constants";
import { getMissingTransactionRequirements } from "@/lib/form-validation";
import { getMissingIfcsfFormAFields } from "@/lib/form-a-validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BigCheckbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SealEditor, type SealDraft } from "@/components/seal-editor";
import { SignatureField } from "@/components/signature-pad";
import type { CargoType, ClRoute } from "@/lib/database.types";

const initialState: ActionState = { error: null };

// Set at build time to point the whitelist-rejection callout at a real
// inbox; falls back to a generic "contact your fleet admin" line when unset.
const FLEET_ADMIN_EMAIL = process.env.NEXT_PUBLIC_FLEET_ADMIN_EMAIL;

interface TransactionFormProps {
  /** Defaults for the IFCSF Part A certifying-staff fields — the logged-in driver, editable/confirmable. */
  certifyingName: string;
  certifyingId: string;
}

export function TransactionForm({ certifyingName: defaultName, certifyingId: defaultId }: TransactionFormProps) {
  const [state, formAction, pending] = useActionState(createClTransaction, initialState);
  const [route, setRoute] = useState<ClRoute | "">("");
  const [searchDone, setSearchDone] = useState(false);
  const [seals, setSeals] = useState<SealDraft[]>([
    { seal_number: "", seal_type: "TRUCK_SEAL", seal_color: "" },
  ]);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);

  // IFCSF Part A (AA/SEC/F/010) — station, in-flight supplies breakdown,
  // certifying staff, and signature. Required for every movement type
  // creatable here (all are IFCSF Outbound/Inbound variants).
  const [station, setStation] = useState("");
  const [carts, setCarts] = useState("");
  const [smu, setSmu] = useState("");
  const [pallets, setPallets] = useState("");
  const [boxes, setBoxes] = useState("");
  const [ovenRack, setOvenRack] = useState("");
  const [certifyingName, setCertifyingName] = useState(defaultName);
  const [certifyingId, setCertifyingId] = useState(defaultId);
  const [signature, setSignature] = useState<string | null>(null);

  const isInbound = route === "INBOUND";

  const toggleCargoType = (type: CargoType) => {
    setCargoTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const sealsReady = seals.length > 0 && seals.every((s) => s.seal_number.trim() !== "" && s.seal_color !== "");

  const missingRequirements = [
    ...getMissingTransactionRequirements({
      route,
      cargoTypesCount: cargoTypes.length,
      sealsReady,
      vehicleSearchCompleted: searchDone,
    }),
    ...getMissingIfcsfFormAFields({
      station,
      carts,
      smu,
      pallets,
      boxes,
      ovenRack,
      certifyingName,
      certifyingId,
      hasSignature: signature !== null,
    }),
  ];
  const isWhitelistViolation = state.error?.startsWith("WHITELIST_VIOLATION:") ?? false;

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
              <Label htmlFor="vehicle_number">{isInbound ? "Vehicle Registration No" : "Vehicle Number"}</Label>
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
          {isInbound ? (
            <p className="-mt-3 text-xs text-muted-foreground">
              The truck seal above is the &quot;Outbound Seal Serial No&quot; on the IFCSF Inbound form.
            </p>
          ) : null}

          <BigCheckbox
            id="vehicle_search_completed"
            name="vehicle_search_completed"
            label="Vehicle search completed"
            description="Cab, cargo area and undercarriage inspected before dispatch."
            checked={searchDone}
            onCheckedChange={setSearchDone}
            required
          />

          <div className="space-y-4 rounded-xl border border-border p-4">
            <div>
              <h3 className="font-heading text-sm font-semibold">IFCSF Part A — In-flight Warehouse</h3>
              <p className="text-xs text-muted-foreground">
                Certifies the consignment has been searched and contains no prohibited article.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Input id="station" name="station" value={station} onChange={(e) => setStation(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["carts", "Carts", carts, setCarts],
                  ["smu", "SMU", smu, setSmu],
                  ["pallets", "Pallets", pallets, setPallets],
                  ["boxes", "Boxes", boxes, setBoxes],
                  ["oven_rack", "Oven Rack", ovenRack, setOvenRack],
                ] as const
              ).map(([name, label, value, setValue]) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={name}>{label}</Label>
                  <Input
                    id={name}
                    name={name}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="certifying_name">Certifying Staff Name</Label>
                <Input
                  id="certifying_name"
                  name="certifying_name"
                  value={certifyingName}
                  onChange={(e) => setCertifyingName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="certifying_id">Certifying Staff ID</Label>
                <Input
                  id="certifying_id"
                  name="certifying_id"
                  value={certifyingId}
                  onChange={(e) => setCertifyingId(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
            </div>

            <SignatureField label="Certifying Signature" onChange={setSignature} />
            <input type="hidden" name="signature" value={signature ?? ""} />

            <p className="text-xs text-muted-foreground">
              Date/time is recorded automatically at submission — no need to enter it.
            </p>
          </div>

          {state.error ? (
            isWhitelistViolation ? (
              <div
                role="alert"
                className="space-y-2 rounded-xl border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.08)] p-4"
              >
                <p className="text-sm font-medium text-[#FB7185]">
                  {state.error.replace(/^WHITELIST_VIOLATION:\s*/, "")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {FLEET_ADMIN_EMAIL ? (
                    <>
                      This vehicle/driver isn&apos;t on the active whitelist yet. Email your fleet admin at{" "}
                      <a
                        href={`mailto:${FLEET_ADMIN_EMAIL}?subject=${encodeURIComponent("CaterLink whitelist request")}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {FLEET_ADMIN_EMAIL}
                      </a>{" "}
                      to add it, then try again.
                    </>
                  ) : (
                    "This vehicle/driver isn't on the active whitelist yet. Contact your fleet admin (VECTA Supervisor) to add it, then try again."
                  )}
                </p>
              </div>
            ) : (
              <p role="alert" className="text-sm font-medium text-[#FB7185]">
                {state.error}
              </p>
            )
          ) : null}

          {missingRequirements.length > 0 ? (
            <p role="alert" className="text-sm font-medium text-[#FB923C]">
              Before you can submit, complete: {missingRequirements.join(", ")}.
            </p>
          ) : null}

          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={pending || missingRequirements.length > 0}
          >
            {pending ? "Creating…" : "Create Transaction & Generate QR"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
