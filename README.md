# ColonyModels

A sandbox for prototyping and evaluating modeling approaches for interstellar
colonies — demographics, economy, infrastructure, environment, governance, and
whatever else turns out to matter. The goal is to compare options side-by-side
in an interactive 3D viewer and pick the ones that hold up.

Models proven out here are intended to feed into
[**MeridianWorlds**](../MeridianWorlds), which owns the canonical starfield,
worlds, and ship data. ColonyModels is upstream R&D; MeridianWorlds is the
production world.

## Stack

- **Server** — TypeScript + Express, runs on **port 8001** (MeridianWorlds
  occupies 8000)
- **Client** — Vite + React + [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber)
  + `@react-three/drei`, runs on port 5173
- **Workspace** — npm workspaces, single `package.json` at the root

The Vite dev server proxies `/api/*` → `http://localhost:8001`, so the client
never has to know which backend port it's hitting.

## Getting started

Requires Node 20+ and npm 10+.

```bash
npm install
npm run dev
```

This starts the server and client in parallel:

- Client: <http://localhost:5173>
- Server: <http://localhost:8001> (try `/health`)

Other scripts:

```bash
npm run build       # build both workspaces
npm run typecheck   # tsc --noEmit on both
```

Override the server port with `PORT=9000 npm --workspace server run dev`.

## Layout

```
ColonyModels/
├── client/         # Vite + React + R3F
│   └── src/
├── server/         # Express + TS
│   └── src/
└── docs/
    ├── design/     # design notes (tracked)
    └── reference/  # local-only material (gitignored)
```

## Relationship to MeridianWorlds

ColonyModels is intentionally **decoupled** from MeridianWorlds at runtime:
different ports, no shared database, no imports across project boundaries.
Models flow in one direction: when a colony model graduates from prototype to
keeper, its schema and logic get promoted into MeridianWorlds proper. Until
then, experiments here are free to break, change shape, or get thrown away.
