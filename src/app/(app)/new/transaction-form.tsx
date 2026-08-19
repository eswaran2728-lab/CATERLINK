"use client";

import { useActionState, useMemo, useState } from "react";
import { PlaneTakeoff, PlaneLanding, Building2, Repeat } from "lucide-react";
import { createTransaction, type ActionState } from "@/lib/actions/transactions";
import { stepsFor } from "@/lib/workflow";
import { CARGO_TYPE_LABELS, CARGO_TYPES, HUB_DESTINATION_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BigCheckbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SignatureField } from "@/components/signature-pad";
import { SealEditor, type SealDraft } from "@/components/seal-editor";
import type { CargoType, Direction, HubDestination, TransactionRoute } from "@/lib/database.types";

const initialState: ActionState = { error: null };

type MovementSelection = "INBOUND" | "OUTBOUND" | "HUB" | "REDQ";

const MOVEMENT_OPTIONS: {
  value: MovementSelection;
  direction: Direction;
  route: TransactionRoute;
  title: string;
  subtitle: string;
  icon: typeof PlaneTakeoff;
}[] = [
  {
    value: "INBOUND",
    direction: "INBOUND",
    route: "AIRCRAFT",
    title: "Inbound",
    subtitle: "Aircraft → SRA warehouse",
    icon: PlaneLanding,
  },
  {
    value: "OUTBOUND",
    direction: "OUTBOUND",
    route: "AIRCRAFT",
    title: "Outbound",
    subtitle: "Catering warehouse → aircraft",
    icon: PlaneTakeoff,
  },
  {
    value: "HUB",
    direction: "OUTBOUND",
    route: "HUB",
    title: "Hub",
    subtitle: "Catering warehouse → hub",
    icon: Building2,
  },
  {
    value: "REDQ",
    direction: "OUTBOUND",
    route: "REDQ",
    title: "REDQ → FOB",
    subtitle: "Re-seal at REDQ, then continue to FOB",
    icon: Repeat,
  },
];

const HUB_DESTINATIONS: HubDestination[] = ["PEN", "JHB", "NILAI"];

/**
 * ICMS inbound/outbound Part A — ported from icms-airasia's part-a-form.tsx.
 * Trimmed for a driver filling this in about themselves: no separate PIC
 * name/staff ID fields (the signed-in driver_ifc profile is the PIC), no
 * escort officer or catering-company picker (office-only fields, not
 * something a driver standing outside a truck fills in).
 */
export function TransactionForm({ driverName, driverStaffId }: { driverName: string; driverStaffId: string }) {
  const [state, formAction, pending] = useActionState(createTransaction, initialState);
  const [movement, setMovement] = useState<MovementSelection | null>(null);
  const [hubDestination, setHubDestination] = useState<HubDestination | "">("");
  const [searchDone, setSearchDone] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverId, setDriverId] = useState("");
  const [seals, setSeals] = useState<SealDraft[]>([
    { seal_number: "", seal_type: "TRUCK_SEAL", seal_color: "" },
  ]);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);

  const toggleCargoType = (type: CargoType) => {
    setCargoTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const sealsReady = seals.length > 0 && seals.every((s) => s.seal_number.trim() !== "" && s.seal_color !== "");

  const selectedOption = MOVEMENT_OPTIONS.find((o) => o.value === movement) ?? null;
  const direction = selectedOption?.direction ?? null;
  const route = selectedOption?.route ?? null;

  const isMaintenance =
    route === "AIRCRAFT" && direction === "OUTBOUND" && cargoTypes.includes("VEHICLE_MAINTENANCE");
  const effectiveRoute = isMaintenance ? "MAINTENANCE" : route;

  const flow = useMemo(
    () =>
      direction && effectiveRoute
        ? ["A · You", ...stepsFor(direction, effectiveRoute).map((s) => s.shortLabel)].join("  →  ")
        : null,
    [direction, effectiveRoute]
  );

  const hubDestinationReady = movement !== "HUB" || hubDestination !== "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-semibold">
            Movement Type
            <span className="ml-2 font-normal text-muted-foreground">What kind of delivery is this?</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MOVEMENT_OPTIONS.map((opt) => {
              const active = movement === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMovement(opt.value);
                    if (opt.value !== "HUB") setHubDestination("");
                  }}
                  aria-pressed={active}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4 text-left transition-all"
                      : "flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent"
                  }
                >
                  <div
                    className={
                      active
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    }
                  >
                    <opt.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold">{opt.title}</p>
                    <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {movement === "HUB" ? (
            <div className="mt-3 space-y-2">
              <Label htmlFor="hub_destination">Hub Destination</Label>
              <Select
                id="hub_destination"
                value={hubDestination}
                onChange={(e) => setHubDestination(e.target.value as HubDestination)}
              >
                <option value="" disabled>
                  Select destination…
                </option>
                {HUB_DESTINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {HUB_DESTINATION_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {flow ? <p className="mt-3 rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">{flow}</p> : null}
        </CardContent>
      </Card>

      {direction === null || route === null ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Select a movement type above to continue.
        </p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form action={formAction} className="space-y-5">
              <input type="hidden" name="direction" value={direction} />
              <input type="hidden" name="route" value={route} />
              {movement === "HUB" ? <input type="hidden" name="hub_destination" value={hubDestination} /> : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="station">Station</Label>
                  <Input id="station" name="station" placeholder="e.g. KUL" autoCapitalize="characters" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flight_number">Flight Number (optional)</Label>
                  <Input id="flight_number" name="flight_number" placeholder="e.g. AK 703" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aircraft_registration">Aircraft Registration (optional)</Label>
                  <Input id="aircraft_registration" name="aircraft_registration" placeholder="e.g. 9M-AQD" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle_number">Vehicle Number</Label>
                  <Input
                    id="vehicle_number"
                    name="vehicle_number"
                    placeholder="e.g. WKD 4521"
                    autoCapitalize="characters"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_id">Your Driver ID</Label>
                  <Input
                    id="driver_id"
                    name="driver_id"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver_name">Your Name</Label>
                  <Input id="driver_name" name="driver_name" defaultValue={driverName} required />
                  <p className="text-xs text-muted-foreground">Must match your registered whitelist name exactly.</p>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm font-semibold">
                  In-flight Supplies
                  <span className="ml-2 font-normal text-muted-foreground">(IFCSF Part A — AA/SEC/F/010)</span>
                </p>

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
                  {isMaintenance ? (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      GSE Workshop (Maintenance): this transaction completes at Part C — Airport Post (Post 6).
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplies_total">Total Number In-flight Supplies (optional)</Label>
                  <Input id="supplies_total" name="supplies_total" type="number" min={0} className="max-w-xs" />
                </div>
              </div>

              <SealEditor seals={seals} onChange={setSeals} />
              <input type="hidden" name="seals" value={JSON.stringify(seals)} />

              <BigCheckbox
                id="vehicle_search_completed"
                name="vehicle_search_completed"
                label="Vehicle search completed"
                description="Cab, cargo area and undercarriage inspected before sealing."
                checked={searchDone}
                onCheckedChange={setSearchDone}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks (optional)</Label>
                <Textarea id="remarks" name="remarks" rows={2} />
              </div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Driver:</span>{" "}
                  <span className="font-medium">{driverName}</span>{" "}
                  <span className="text-muted-foreground">({driverStaffId})</span>
                </p>
              </div>

              <SignatureField onChange={setSignature} />
              <input type="hidden" name="signature" value={signature ?? ""} />

              {state.error ? (
                <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                  {state.error.replace(/^(EXPIRED_PASS|WHITELIST_VIOLATION):\s*/, "")}
                </p>
              ) : null}

              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={
                  pending ||
                  !searchDone ||
                  !signature ||
                  !sealsReady ||
                  cargoTypes.length === 0 ||
                  !hubDestinationReady
                }
              >
                {pending ? "Creating…" : "Create Transaction & Generate QR"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
