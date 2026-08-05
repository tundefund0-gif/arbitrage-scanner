import { Router, type IRouter, type Response } from "express";
import {
  GetScannerOpportunitiesQueryParams,
  GetScannerOpportunityParams,
  GetScannerOpportunitiesResponse,
  GetScannerOpportunityResponse,
  GetScannerNetworksResponse,
  GetScannerSummaryResponse,
  GetScannerTokensResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

type ChainId = "ethereum" | "arbitrum";
type TokenDefinition = {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Partial<Record<ChainId, string>>;
};
type Venue = {
  name: string;
  chain: string;
  priceUsd: number;
  liquidityUsd: number;
  feeBps: number;
  pairAddress: string;
  dexUrl: string;
  volume24h?: number;
};
type Opportunity = {
  id: string;
  token: string;
  pair: string;
  chain: string;
  spreadBps: number;
  spreadPct: number;
  buyVenue: Venue;
  sellVenue: Venue;
  profit: {
    grossProfitUsd: number;
    flashLoanFeeUsd: number;
    gasCostUsd: number;
    dexFeesUsd: number;
    slippageUsd: number;
    netProfitUsd: number;
    recommendedBorrowUsd: number;
    confidence: "high" | "medium" | "low";
  };
  detectedAt: string;
  blockNumber: number;
  executable: boolean;
  status: "new" | "monitoring" | "stale";
};

const TOKEN_DEFINITIONS: TokenDefinition[] = [
  ["WETH", "Wrapped Ether", 18, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"],
  ["USDC", "USD Coin", 6, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"],
  ["USDT", "Tether USD", 6, "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xFd086Bc7CD5C481dcc9C85ebe478A1C0b69FCbb9"],
  ["DAI", "Dai Stablecoin", 18, "0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"],
  ["WBTC", "Wrapped Bitcoin", 8, "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"],
  ["LINK", "Chainlink", 18, "0x514910771AF9Ca656af840dff83E8264EcF986CA", "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4"],
  ["UNI", "Uniswap", 18, "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", "0xfa7F8980b0f1E64A2067F7cA8F97C3d7aC4f6E2A"],
  ["AAVE", "Aave", 18, "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DdAe9", "0xba5DdD1f9d7F570dc94a51479a000E3BCE967196"],
  ["ARB", "Arbitrum", 18, "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", "0x912CE59144191C1204E64559FE8253a0e49E6548"],
  ["CRV", "Curve DAO Token", 18, "0xD533a949740bb3306d119CC777fa900bA034cd52", "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978"],
  ["COMP", "Compound", 18, "0xc00e94Cb662C3520282E6f5717214004A7f26888", "0x354A6dA3fcde098F8389cad84b0182725c6C91dE"],
  ["SNX", "Synthetix Network Token", 18, "0xC011a72400E58ecD99ee497CF89E3775d4bd732F"],
  ["SUSHI", "Sushi", 18, "0x6B3595068778DD592e39A122f4f5a5Cf09C90fE"],
  ["LDO", "Lido DAO", 18, "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32"],
  ["MKR", "Maker", 18, "0x9f8F72aA9304c8B593d555F12eF6589Cc3A579A2"],
  ["ENS", "Ethereum Name Service", 18, "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72"],
  ["1INCH", "1inch", 18, "0x111111111117dC0aa78b770fA6A738034120C302"],
  ["YFI", "yearn.finance", 18, "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e"],
  ["GRT", "The Graph", 18, "0xc944E90C64B2c07662A292be6244BDf05Cda44a7"],
  ["STETH", "Lido Staked Ether", 18, "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"],
  ["PENDLE", "Pendle", 18, "0x808507121B80C02388fAd14726482e061B8da827", "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8"],
  ["APE", "ApeCoin", 18, "0x4d224452801ACEd8B2F0aebe155379bb5D594381"],
  ["MAGIC", "Magic", 18, undefined, "0x539bdE0d7Dbd336b79148AA742883198BBF60342"],
  ["RDNT", "Radiant Capital", 18, undefined, "0x3082CC23568eA640225c2467653dB90e9250AaA0"],
  ["JONES", "Jones DAO", 18, undefined, "0x10393c20975cF177a3513071BC110f7962CD67da"],
  ["LPT", "Livepeer", 18, "0x58b6A8A3302369DAEc383334672404Ee733aB239", "0x289ba1701C2f088cf0faf8B3705246331cb8A839"],
].map(([symbol, name, decimals, ethereum, arbitrum]) => ({
  symbol: symbol as string,
  name: name as string,
  decimals: decimals as number,
  addresses: { ethereum: ethereum as string | undefined, arbitrum: arbitrum as string | undefined },
}));

const RPCS: Record<ChainId, { chainId: number; name: string; url: string; explorer: string }> = {
  ethereum: { chainId: 1, name: "Ethereum", url: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io" },
  arbitrum: { chainId: 42161, name: "Arbitrum One", url: "https://arbitrum-one-rpc.publicnode.com", explorer: "https://arbiscan.io" },
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const TTL_MS = 20_000;

async function jsonFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Upstream ${response.status} from ${new URL(url).hostname}`);
  return response.json() as Promise<T>;
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await loader();
  cache.set(key, { expiresAt: Date.now() + TTL_MS, value });
  return value;
}

async function rpc(chain: ChainId, method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(RPCS[chain].url, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${response.status} on ${chain}`);
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? `RPC error on ${chain}`);
  return body.result;
}

function hexNumber(value: unknown): number {
  return typeof value === "string" ? Number.parseInt(value, 16) : 0;
}

async function networkStatus(chain: ChainId) {
  const blockHex = await rpc(chain, "eth_blockNumber");
  const [gasHex, latest, previous] = await Promise.all([
    rpc(chain, "eth_gasPrice"),
    rpc(chain, "eth_getBlockByNumber", ["latest", false]),
    rpc(chain, "eth_getBlockByNumber", [
      `0x${Math.max(0, hexNumber(blockHex) - 1).toString(16)}`,
      false,
    ]),
  ]);
  const current = latest as { timestamp?: string } | null;
  const parent = previous as { timestamp?: string } | null;
  const blockNumber = hexNumber(blockHex);
  const currentTime = hexNumber(current?.timestamp);
  const parentTime = hexNumber(parent?.timestamp);
  return {
    id: chain,
    name: RPCS[chain].name,
    chainId: RPCS[chain].chainId,
    status: "healthy" as const,
    blockNumber,
    gasGwei: hexNumber(gasHex) / 1e9,
    blockTimeMs: Math.max(0, (currentTime - parentTime) * 1000),
    pools: 0,
    lastBlockAt: currentTime ? new Date(currentTime * 1000).toISOString() : new Date().toISOString(),
  };
}

type DexPair = {
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  labels?: string[];
};

function tokenPrice(pair: DexPair, address: string): number {
  const baseAddress = pair.baseToken?.address?.toLowerCase();
  const basePrice = Number(pair.priceUsd ?? 0);
  if (baseAddress === address.toLowerCase()) return basePrice;
  const nativeRatio = Number(pair.priceNative ?? 0);
  return basePrice > 0 && nativeRatio > 0 ? basePrice / nativeRatio : 0;
}

async function pairsFor(chain: ChainId, address: string): Promise<DexPair[]> {
  const raw = await cached(`pairs:${chain}:${address.toLowerCase()}`, () =>
    jsonFetch<unknown[]>(`https://api.dexscreener.com/token-pairs/v1/${chain}/${address}`),
  );
  return Array.isArray(raw) ? (raw as DexPair[]) : [];
}

async function liveMarkets(chain: ChainId) {
  const definitions = TOKEN_DEFINITIONS
    .map((token) => ({ token, address: token.addresses[chain] }))
    .filter((item): item is { token: TokenDefinition; address: string } => Boolean(item.address));
  const results = await Promise.allSettled(
    definitions.map(async ({ token, address }) => ({ token, pairs: await pairsFor(chain, address) })),
  );
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

function buildOpportunities(
  chain: ChainId,
  markets: Awaited<ReturnType<typeof liveMarkets>>,
  blockNumber: number,
): Opportunity[] {
  const output: Opportunity[] = [];
  for (const { token, pairs } of markets) {
    const address = token.addresses[chain];
    if (!address) continue;
    const priced = pairs
      .map((pair) => ({ pair, priceUsd: tokenPrice(pair, address) }))
      .filter(({ pair, priceUsd }) =>
        priceUsd > 0 && Number(pair.liquidity?.usd ?? 0) > 10_000 && pair.dexId && pair.pairAddress,
      );
    const prices = priced.map(({ priceUsd }) => priceUsd).sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const usable: Venue[] = priced
      .filter(({ priceUsd }) => median > 0 && priceUsd >= median * 0.7 && priceUsd <= median * 1.3)
      .map(({ pair, priceUsd }) => ({
        name: pair.dexId!.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        chain: RPCS[chain].name,
        priceUsd,
        liquidityUsd: Number(pair.liquidity?.usd ?? 0),
        feeBps: 30,
        pairAddress: pair.pairAddress!,
        dexUrl: pair.url ?? `${RPCS[chain].explorer}/address/${pair.pairAddress}`,
        volume24h: Number(pair.volume?.h24 ?? 0),
      }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    for (const buy of usable) {
      for (const sell of usable) {
        if (sell.pairAddress === buy.pairAddress || sell.priceUsd <= buy.priceUsd) continue;
        const spreadPct = ((sell.priceUsd - buy.priceUsd) / buy.priceUsd) * 100;
        const spreadBps = spreadPct * 100;
        if (spreadBps < 2) continue;
        const borrow = Math.min(100_000, buy.liquidityUsd * 0.05, sell.liquidityUsd * 0.05);
        const gross = borrow * spreadPct / 100;
        const dexFees = borrow * (buy.feeBps + sell.feeBps) / 10_000;
        const slippage = gross * 0.25;
        const flashLoan = borrow * 0.0005;
        const gas = chain === "arbitrum" ? 1.75 : 18;
        const net = gross - dexFees - slippage - flashLoan - gas;
        output.push({
          id: `${chain}-${token.symbol.toLowerCase()}-${buy.pairAddress.toLowerCase().replace(/[^a-f0-9]/g, "")}-${sell.pairAddress.toLowerCase().replace(/[^a-f0-9]/g, "")}`,
          token: token.symbol,
          pair: `${token.symbol}/USD`,
          chain: RPCS[chain].name,
          spreadBps: Number(spreadBps.toFixed(2)),
          spreadPct: Number(spreadPct.toFixed(4)),
          buyVenue: buy,
          sellVenue: sell,
          profit: {
            grossProfitUsd: Number(gross.toFixed(2)),
            flashLoanFeeUsd: Number(flashLoan.toFixed(2)),
            gasCostUsd: Number(gas.toFixed(2)),
            dexFeesUsd: Number(dexFees.toFixed(2)),
            slippageUsd: Number(slippage.toFixed(2)),
            netProfitUsd: Number(net.toFixed(2)),
            recommendedBorrowUsd: Number(borrow.toFixed(2)),
            confidence: net > 0 && spreadBps > 15 ? "medium" : "low",
          },
          detectedAt: new Date().toISOString(),
          blockNumber,
          executable: net > 0 && spreadBps > 10,
          status: "new",
        });
      }
    }
  }
  return output.sort((a, b) => b.profit.netProfitUsd - a.profit.netProfitUsd);
}

async function scan(chain: "all" | ChainId) {
  const chains: ChainId[] = chain === "all" ? ["ethereum", "arbitrum"] : [chain];
  return Promise.all(chains.map(async (item) => {
    const [status, markets] = await Promise.all([networkStatus(item), liveMarkets(item)]);
    const opportunities = buildOpportunities(item, markets, status.blockNumber);
    const pools = markets.reduce((sum, market) => sum + market.pairs.length, 0);
    return { status: { ...status, pools }, markets, opportunities };
  }));
}

function error(res: Response, message: string) {
  res.status(503).json({ error: message });
}

const router: IRouter = Router();

router.get("/scanner/networks", async (_req, res) => {
  try {
    const networks = await Promise.all((Object.keys(RPCS) as ChainId[]).map(async (chain) => {
      const [status, markets] = await Promise.all([networkStatus(chain), liveMarkets(chain)]);
      return {
        ...status,
        pools: markets.reduce((sum, market) => sum + market.pairs.length, 0),
      };
    }));
    res.json(GetScannerNetworksResponse.parse(networks));
  } catch (err) {
    logger.warn({ err }, "live network status unavailable");
    error(res, "Live network status is unavailable. No network data was fabricated.");
  }
});

router.get("/scanner/tokens", async (_req, res) => {
  try {
    const markets = await Promise.all(
      (Object.keys(RPCS) as ChainId[]).map(async (chain) => ({ chain, markets: await liveMarkets(chain) })),
    );
    const bySymbol = new Map<string, {
      symbol: string;
      name: string;
      address: string;
      decimals: number;
      chains: string[];
      liquidityUsd: number;
      pools: number;
      priceUsd: number;
      change24h: number;
    }>();
    markets.forEach(({ chain, markets: chainMarkets }) => chainMarkets.forEach(({ token, pairs }) => {
      const address = token.addresses[chain];
      if (!address) return;
      const usable = pairs
        .map((pair) => ({ pair, priceUsd: tokenPrice(pair, address) }))
        .filter(({ priceUsd }) => priceUsd > 0);
      const liquid = usable.reduce((sum, item) => sum + Number(item.pair.liquidity?.usd ?? 0), 0);
      const top = usable.sort(
        (a, b) => Number(b.pair.liquidity?.usd ?? 0) - Number(a.pair.liquidity?.usd ?? 0),
      )[0];
      const existing = bySymbol.get(token.symbol);
      bySymbol.set(token.symbol, {
        symbol: token.symbol,
        name: token.name,
        address,
        decimals: token.decimals,
        chains: existing?.chains.includes(RPCS[chain].name)
          ? existing.chains
          : [...(existing?.chains ?? []), RPCS[chain].name],
        liquidityUsd: Number((existing?.liquidityUsd ?? 0) + liquid),
        pools: (existing?.pools ?? 0) + usable.length,
        priceUsd: Number(top?.priceUsd ?? existing?.priceUsd ?? 0),
        change24h: Number(top?.pair.priceChange?.h24 ?? 0),
      });
    }));
    res.json(GetScannerTokensResponse.parse(
      [...bySymbol.values()].filter((token) => token.pools > 0 && token.priceUsd > 0),
    ));
  } catch (err) {
    logger.warn({ err }, "live token universe unavailable");
    error(res, "Live token coverage is unavailable. No token data was fabricated.");
  }
});

router.get("/scanner/opportunities", async (req, res) => {
  const parsed = GetScannerOpportunitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scanner filters" });
    return;
  }
  try {
    const results = await scan(parsed.data.chain);
    const token = parsed.data.token?.toLowerCase();
    const opportunities = results
      .flatMap((item) => item.opportunities)
      .filter((item) => item.spreadBps >= parsed.data.minProfitBps
        && (!token || item.token.toLowerCase() === token))
      .slice(0, parsed.data.limit);
    res.json(GetScannerOpportunitiesResponse.parse(opportunities));
  } catch (err) {
    logger.warn({ err }, "live opportunity scan unavailable");
    error(res, "Live pool scan is unavailable. No opportunities were fabricated.");
  }
});

router.get("/scanner/opportunities/:id", async (req, res) => {
  const parsed = GetScannerOpportunityParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid opportunity id" });
    return;
  }
  try {
    const chain = parsed.data.id.startsWith("arbitrum-") ? "arbitrum" : "ethereum";
    const results = await scan(chain);
    const opportunity = results.flatMap((item) => item.opportunities)
      .find((item) => item.id === parsed.data.id);
    if (!opportunity) {
      res.status(404).json({ error: "Live opportunity is no longer available" });
      return;
    }
    res.json(GetScannerOpportunityResponse.parse(opportunity));
  } catch (err) {
    logger.warn({ err }, "live opportunity detail unavailable");
    error(res, "Live opportunity detail is unavailable. No opportunity was fabricated.");
  }
});

router.get("/scanner/summary", async (_req, res) => {
  try {
    const started = Date.now();
    const results = await scan("all");
    const opportunities = results.flatMap((item) => item.opportunities);
    const summary = {
      activeOpportunities: opportunities.length,
      poolsScanned: results.reduce((sum, item) => sum + item.status.pools, 0),
      tokensTracked: new Set(results.flatMap((item) => item.markets.map((market) => market.token.symbol))).size,
      estimatedNetProfit24h: Number(
        opportunities
          .filter((item) => item.profit.netProfitUsd > 0)
          .reduce((sum, item) => sum + item.profit.netProfitUsd, 0)
          .toFixed(2),
      ),
      lastScanAt: new Date().toISOString(),
      scanLatencyMs: Date.now() - started,
    };
    res.json(GetScannerSummaryResponse.parse(summary));
  } catch (err) {
    logger.warn({ err }, "live scanner summary unavailable");
    error(res, "Live scanner summary is unavailable. No metrics were fabricated.");
  }
});

export default router;