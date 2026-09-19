# Arbitrage Scanner

Live market-intelligence software for discovering, ranking, and inspecting cross-chain arbitrage opportunities across Ethereum and Arbitrum liquidity.

> **Find the gap before it closes.**

The repository contains the React/Vite scanner cockpit, a shared Express API server, and the contract-generated TypeScript clients used by the frontend and backend.

## What it does

- Scans a controlled, verified Ethereum and Arbitrum token universe using live RPC and market-data sources.
- Discovers 609 listed candidates from the Uniswap token list, selects up to 150 per chain, and keeps the curated blue-chip set as a transparent fallback.
- Uses DexScreener batch discovery plus full pair-list reads for the highest-priority 60 tokens per chain, with one shared 25-second snapshot across all dashboard endpoints.
- Ranks price dislocations by estimated net profit.
- Shows buy and sell venues, spread, liquidity, fees, slippage, gas, flash-loan costs, and confidence.
- Provides live network telemetry including block height, gas price, block time, scanned token count, liquid pool count, venue count, and unique pool count.
- Displays tracked token coverage, verified candidate breadth, liquidity, prices, pool counts, venue volume, supported chains, and 24-hour change.
- Supports chain and spread filters, refresh, route detail inspection, venue links, and mobile navigation.
- Exposes explicit loading, empty, retry, and upstream-unavailable states instead of silently fabricating market data.

## Repository layout

```text
.
├── artifacts/
│   ├── api-server/              Express API service
│   │   └── src/routes/scanner.ts
│   ├── arb-scanner/             React/Vite web application
│   │   └── src/App.tsx
│   └── mockup-sandbox/          Component preview artifact
├── lib/
│   ├── api-spec/openapi.yaml    Source-of-truth API contract
│   ├── api-client-react/        Generated React Query client and schemas
│   ├── api-zod/                 Generated server validation schemas
│   └── db/                      Shared database package scaffold
├── scripts/                     Workspace utility scripts
├── package.json                 Root workspace scripts
├── pnpm-workspace.yaml          Workspace and dependency policy
└── pnpm-lock.yaml               Locked dependency graph
```

## Requirements

- Node.js 24
- pnpm
- Network access to the configured Ethereum and Arbitrum RPC endpoints
- Network access to DexScreener market-data endpoints

The API server requires a runtime-provided `PORT`. The web artifact requires `PORT` and `BASE_PATH`; the managed Replit workflows provide these automatically.

## Install

```bash
pnpm install
```

## Run locally

Start the shared API server:

```bash
pnpm --filter @workspace/api-server run dev
```

Start the scanner frontend in a second terminal:

```bash
PORT=26056 BASE_PATH=/ pnpm --filter @workspace/arb-scanner run dev
```

The frontend calls the shared API at `/api`. When running outside the managed artifact workflow, make sure the API server is reachable through the same local development setup.

## Verification commands

Run the workspace checks:

```bash
pnpm run typecheck
pnpm run build
```

Check each package directly:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/arb-scanner run typecheck
PORT=26056 BASE_PATH=/ pnpm --filter @workspace/arb-scanner run build
```

## API contract and code generation

The API contract is maintained in `lib/api-spec/openapi.yaml`. After changing an endpoint or schema, regenerate the React Query client and Zod schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated files are committed because the frontend and API server consume them directly:

- `lib/api-client-react/src/generated/api.ts`
- `lib/api-client-react/src/generated/api.schemas.ts`
- `lib/api-zod/src/generated/api.ts`
- `lib/api-zod/src/generated/types/*`

## API endpoints

All endpoints are mounted below `/api`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/healthz` | API health check |
| `GET /api/scanner/summary` | Active opportunity, pool, token, venue, discovery, profit, and latency summary |
| `GET /api/scanner/networks` | Ethereum and Arbitrum network telemetry plus scan coverage |
| `GET /api/scanner/tokens` | Live tracked token universe |
| `GET /api/scanner/opportunities` | Ranked opportunities with optional filters |
| `GET /api/scanner/opportunities/:id` | Live detail for one opportunity |

Opportunity query parameters:

- `chain`: `all`, `ethereum`, or `arbitrum`
- `token`: token symbol filter
- `minProfitBps`: minimum spread in basis points
- `limit`: number of results, from 1 to 100

## Live data behavior

The scanner uses a shared short-lived in-memory snapshot so summary, network, token, opportunity, and detail requests reuse one coherent market pass. DexScreener batch reads discover the wider token surface, while detailed pair-list reads cover the highest-priority tokens on each chain. It does not persist market snapshots or invent fallback opportunities.

Upstream data sources currently include:

- Public Ethereum and Arbitrum JSON-RPC endpoints for block and gas telemetry.
- Uniswap's public token list for verified token metadata and candidate discovery.
- DexScreener batch and token-pair data for live liquidity, prices, venues, volume, and price change.

If an upstream source is unavailable, the API returns a service-unavailable response and the frontend renders an explicit unavailable state.

## Frontend structure

The main dashboard lives in `artifacts/arb-scanner/src/App.tsx`, with the visual system in `artifacts/arb-scanner/src/index.css`.

The cockpit includes:

- Live system health and refresh controls.
- Summary metrics for opportunity count, estimated net profit, pools, and scan latency.
- Network pulse cards.
- Filterable executable opportunity table.
- Opportunity detail drawer with route economics.
- Token universe coverage cards.
- Responsive mobile navigation and layouts.

## Deployment

The web artifact is registered at the root preview path and is configured in:

```text
artifacts/arb-scanner/.replit-artifact/artifact.toml
```

The API server is registered separately in:

```text
artifacts/api-server/.replit-artifact/artifact.toml
```

For Replit, use the managed workflows so `PORT`, `BASE_PATH`, and artifact routing are injected correctly.

## Security notes

- Do not commit API keys, GitHub tokens, RPC credentials, or `.env` files.
- Use the workspace secret manager for sensitive values.
- Keep the GitHub repository private unless the project owner explicitly wants a public repository.