---
name: DexScreener pool coverage
description: The different pool-depth behavior of DexScreener's batch and per-token endpoints.
---

DexScreener's `tokens/v1/{chain}/{addresses}` endpoint is useful for broad token discovery but returns only one best pair per token. The `token-pairs/v1/{chain}/{address}` endpoint is required when the scanner needs the full pool list for a token.

**Why:** Treating the batch response as a complete pool scan understated live pool coverage and missed venue-level arbitrage routes.

**How to apply:** Use batched reads to discover a wide token surface, then reserve per-token pair-list reads for the prioritized assets whose pools feed opportunity ranking and pool-count metrics.