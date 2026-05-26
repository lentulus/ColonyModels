import { z } from "zod";

// Zod schemas mirror the wire-level domain shapes for `@colonymodels/shared`.
// These are the I/O boundary — every POST/PUT/DELETE payload runs through one
// of these before touching the db. Boundary contracts pinned by Slice 3.1.2
// tests (expectZod400 helper, plus the four rejection cases).
//
// Defense in depth: N >= 0 is enforced here AND clamped in the math layer
// (rk4Step), so negative N never reaches storage even if the math layer is
// bypassed.

export const stateCSchema = z.object({
  N: z.number().nonnegative(),
  S: z.number(),
});

export const paramsCSchema = z.object({
  r: z.number(),
  beta: z.number(),
  c: z.number(),
  s0: z.number(),
});

export const modelKindSchema = z.enum(["C-basic-demfisc"]);

// Body shape for POST /api/runs. Excludes server-minted id + createdAt.
export const createRunBodySchema = z.object({
  name: z.string().min(1),
  modelKind: modelKindSchema,
  t0Epoch: z.number().int(),
  tickSeconds: z.number().int().positive(),
  peoplePerUnit: z.number().positive(),
  initialState: stateCSchema,
  initialParams: paramsCSchema,
});

// Discriminated union matches shared/Event verbatim.
export const eventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("param-set"),
    tEpoch: z.number(),
    param: z.enum(["r", "beta", "c", "s0"]),
    value: z.number(),
  }),
  z.object({
    kind: z.literal("state-poke"),
    tEpoch: z.number(),
    patch: z.object({ N: z.number().optional(), S: z.number().optional() }),
  }),
  z.object({
    kind: z.literal("stop"),
    tEpoch: z.number(),
  }),
]);

export const snapshotSchema = z.object({
  tEpoch: z.number(),
  state: stateCSchema,
});

export const snapshotArraySchema = z.array(snapshotSchema);

// `?after=T` for DELETE branch ops. Coerces from query string; rejects NaN
// (z.coerce.number() accepts NaN by default; refine to reject).
export const afterQuerySchema = z.object({
  after: z.coerce.number().refine((v) => Number.isFinite(v), {
    message: "must be a finite number",
  }),
});
