"use client";

import { useActionState, useState } from "react";
import { createTransaction, type ActionState } from "@/lib/actions/transactions";
import {
  CARGO_TYPE_LABELS,
  CARGO_TYPES,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  type MovementType,
} from "@/lib/constants";
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
import type { CargoType, HubDestination } from "@/lib/database.types";

const initialState: ActionState = { error: null };

// Set at build time to point the whitelist-rejection callout at a real
// inbox; falls back to a generic "contact your fleet admin" line when unset.
const FLEET_ADMIN_EMAIL = process.env.NEXT_PUBLIC_FLEET_ADMIN_EMAIL;

const HUB_DESTINATION_LABELS: Record<HubDestination, string> = {
  PEN: "Penang (PEN)",
  JHB: "Johor Bahru (JHB)",
  NILAI: "Nilai",
};

interface TransactionFormProps {
  /** Defaults for the IFCSF Part A PIC fields — the logged-in driver, editable/confirmable. */
  picName: string;
  picStaffId: string;
}

export function TransactionForm({ picName: defaultName, picStaffId: defaultId }: TransactionFormProps) {
  const [state, formAction, pending] = useActionState(createTransaction, initialState);
  const [movementType, setMovementType] = useState<MovementType | "">("");
  const [hubDestination, setHubDestination] = useState<HubDestination | "">("");
  const [searchDone, setSearchDone] = useState(false);
  const [seals, setSeals] = useState<SealDraft[]>([
    { seal_number: "", seal_type: "TRUCK_SEAL", seal_color: "" },
  ]);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);

  const [station, setStation] = useState("");
  const [carts, setCarts] = useState("");
  const [smu, setSmu] = useState("");
  const [pallets, setPallets] = useState("");
  const [boxes, setBoxes] = useState("");
  const [ovenRack, setOvenRack] = useState("");
  const [picName, setPicName] = useState(defaultName);
  const [picStaffId, setPicStaffId] = useState(defaultId);
  const [signature, setSignature] = useState<string | null>(null);

  const isInbound = movementType === "INBOUND";
  const isHub = movementType === "HUB";

  const toggleCargoType = (type: CargoType) => {
    setCargoTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const sealsReady = seals.length > 0 && seals.every((s) => s.seal_number.trim() !== "" && s.seal_color !== "");

  const missingRequirements = [
    ...getMissingTransactionRequirements({
      route: movementType,
      cargoTypesCount: cargoTypes.length,
      sealsReady,
      vehicleSearchCompleted: searchDone,
    }),
    ...(isHub && !hubDestination ? ["hub destination"] : []),
    ...getMissingIfcsfFormAFields({
      station,
      carts,
      smu,
      pallets,
      boxes,
      ovenRack,
      certifyingName: picName,
      certifyingId: picStaffId,
      hasSignature: signature !== null,
    }),
  ];
  const isWhitelistViolation = state.error?.startsWith("WHITELIST_VIOLATION:") ?? false;

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="movement_type">Movement Type</Label>
            <Select
              id="movement_type"
              name="movement_type"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as MovementType)}
              required
            >
              <option value="" disabled>
                Select…
              </option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {isHub ? (
            <div className="space-y-2">
              <Label htmlFor="hub_destination">Hub Destination</Label>
              <Select
                id="hub_destination"
                name="hub_destination"
                value={hubDestination}
                onChange={(e) => setHubDestination(e.target.value as HubDestination)}
                required
              >
                <option value="" disabled>
                  Select…
                </option>
                {(Object.entries(HUB_DESTINATION_LABELS) as [HubDestination, string][]).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

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
                <Label htmlFor="pic_name">PIC Name</Label>
                <Input id="pic_name" name="pic_name" value={picName} onChange={(e) => setPicName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pic_staff_id">PIC Staff ID</Label>
                <Input
                  id="pic_staff_id"
                  name="pic_staff_id"
                  value={picStaffId}
                  onChange={(e) => setPicStaffId(e.target.value)}
                  required
                  className="font-mono"
                />
              </div>
            </div>

            <SignatureField label="PIC Signature" onChange={setSignature} />
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
                <p className="text-sm font-medium text-[#DC2626]">
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
              <p role="alert" className="text-sm font-medium text-[#DC2626]">
                {state.error}
              </p>
            )
          ) : null}

          {missingRequirements.length > 0 ? (
            <p role="alert" className="text-sm font-medium text-[#EA580C]">
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
