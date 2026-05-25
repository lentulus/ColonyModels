// Shared types for ColonyModels Phase 1.
// Source of truth: Phase1Design.md §3.
// The discriminator on ModelKind is the seam for Option D (P, E, S) widening
// in Phase 2 — see Phase1Design.md §14.

export type RunId = string; // nanoid

export type ModelKind = "C-basic-demfisc";

export type ParamsC = {
  r: number;     // intrinsic per capita growth rate, yr^-1
  beta: number;  // per capita state expenditure rate
  c: number;     // max gain in carrying capacity from S
  s0: number;    // half-saturation point of k(S)
};

export type StateC = {
  N: number;     // population (scaled)
  S: number;     // accumulated state resources (scaled)
};

export type Run = {
  id: RunId;
  name: string;              // human-readable, required at creation
  modelKind: ModelKind;
  t0Epoch: number;           // founding date, seconds since epoch
  tickSeconds: number;       // week or month
  peoplePerUnit: number;     // display-only multiplier
  initialState: StateC;      // stored in *scaled* units
  initialParams: ParamsC;
  createdAt: number;
};

export type Event =
  | { kind: "param-set"; tEpoch: number; param: keyof ParamsC; value: number }
  | { kind: "state-poke"; tEpoch: number; patch: Partial<StateC> }
  | { kind: "stop"; tEpoch: number };

export type Snapshot = {
  tEpoch: number;
  state: StateC;
};
