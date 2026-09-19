import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity,
  ArrowDownRight,
  BarChart3,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Gauge,
  Layers3,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  TriangleAlert,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetScannerOpportunityQueryKey,
  getGetScannerOpportunitiesQueryKey,
  getGetScannerNetworksQueryKey,
  getGetScannerSummaryQueryKey,
  getGetScannerTokensQueryKey,
  getHealthCheckQueryKey,
  useGetScannerNetworks,
  useGetScannerOpportunity,
  useGetScannerOpportunities,
  useGetScannerSummary,
  useGetScannerTokens,
  useHealthCheck,
} from '@workspace/api-client-react';
import type {
  ArbitrageOpportunity,
  GetScannerOpportunitiesChain,
  NetworkStatus,
  ScannerSummary,
  ScannerToken,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchInterval: 25_000,
      refetchOnWindowFocus: true,
    },
  },
});

const money = (value = 0, compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);

const number = (value = 0) => new Intl.NumberFormat('en-US').format(value);
const ago = (date?: string) => {
  if (!date) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

function Mark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function DataState({
  loading,
  error,
  empty,
  onRetry,
  children,
  label,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
  label: string;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error)
    return (
      <div className="state-box">
        <TriangleAlert size={18} />
        <strong>Feed unavailable</strong>
        <span>Could not reach the {label} stream.</span>
        <button className="button button-quiet" onClick={onRetry} data-testid={`button-retry-${label}`}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="state-box">
        <Search size={18} />
        <strong>No {label} found</strong>
        <span>Try loosening the active filters.</span>
      </div>
    );
  return children;
}

function Sidebar({ mobileOpen, close }: { mobileOpen: boolean; close: () => void }) {
  const [location] = useLocation();
  const links = [
    { label: 'Live scanner', icon: Activity, href: '/' },
    { label: 'Opportunities', icon: Zap, href: '/#opportunities' },
    { label: 'Network health', icon: Signal, href: '/#networks' },
    { label: 'Token universe', icon: Layers3, href: '/#tokens' },
  ];
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" onClick={close} aria-label="Close navigation" data-testid="button-close-navigation" />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <Mark />
            <div><b>ARBITRAGE</b><small>SCANNER / OPS</small></div>
          </div>
          <button className="icon-button mobile-close" onClick={close} aria-label="Close navigation" data-testid="button-close-navigation">
            <X size={17} />
          </button>
        </div>
        <div className="sidebar-rule" />
        <div className="nav-caption">Workspace</div>
        <nav>
          {links.map(({ label, icon: Icon, href }) => (
            <a
              href={href}
              key={label}
              className={`nav-link ${location === href || (href !== '/' && location === '/') ? (href === '/' ? 'nav-active' : '') : ''}`}
              onClick={close}
              data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}
            >
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{href === '/' && <i className="live-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-title"><span className="live-dot" /> Scanner engine</div>
            <div className="system-value">Operational</div>
           <div className="system-meta">polling every 25s</div>
          </div>
          <div className="sidebar-foot"><span>v0.9.4</span><CircleHelp size={15} /></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu, onRefresh, refreshing }: { onMenu: () => void; onRefresh: () => void; refreshing: boolean }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={19} /></button>
      <div className="crumb"><span>Markets</span><ChevronRight size={14} /><b>Live scanner</b></div>
      <div className="top-actions">
        <div className="connection"><span className="live-dot" /> API connected</div>
        <button className="button button-quiet" onClick={onRefresh} disabled={refreshing} data-testid="button-refresh-all">
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> <span className="hide-mobile">Refresh</span>
        </button>
        <div className="avatar">QT</div>
      </div>
    </header>
  );
}

function Summary({ loading, data }: { loading: boolean; data?: ScannerSummary }) {
  const items = [
    { label: 'Active opportunities', value: data ? number(data.activeOpportunities) : '', accent: 'amber', icon: Zap, sub: 'executable now' },
    { label: 'Est. net profit · 24h', value: data ? money(data.estimatedNetProfit24h, true) : '', accent: 'mint', icon: WalletCards, sub: 'after fees + gas' },
    { label: 'Unique pools', value: data ? number(data.uniquePools) : '', accent: 'blue', icon: Layers3, sub: `${data ? number(data.liquidPools) : '—'} liquid above $10k` },
    { label: 'Tracked assets', value: data ? number(data.tokensTracked) : '', accent: 'violet', icon: BarChart3, sub: data ? `${number(data.tokensDiscovered)} verified candidates` : 'awaiting discovery' },
    { label: 'DEX venues', value: data ? number(data.venuesTracked) : '', accent: 'mint', icon: Signal, sub: data ? `${number(data.failedTokens)} token misses` : 'awaiting scan' },
    { label: 'Scan latency', value: data ? `${data.scanLatencyMs}ms` : '', accent: 'violet', icon: Gauge, sub: data ? `last scan ${ago(data.lastScanAt)}` : 'awaiting scan' },
  ];
  return (
    <div className="summary-grid">
      {items.map(({ label, value, accent, icon: Icon, sub }) => (
        <div className="metric-card" key={label}>
          <div className={`metric-icon ${accent}`}><Icon size={16} /></div>
          <div className="metric-label">{label}</div>
          {loading ? <Skeleton className="h-8 w-28 mt-2" /> : <div className="metric-value" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div>}
          <div className="metric-sub">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function NetworkStrip({ data, loading, error, retry }: { data?: NetworkStatus[]; loading: boolean; error: boolean; retry: () => void }) {
  return (
    <section id="networks" className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Infrastructure</div><h2>Network pulse</h2></div><span className="section-note"><span className="live-dot" /> Live blocks</span></div>
      <DataState loading={loading} error={error} empty={!data?.length} onRetry={retry} label="networks">
        <div className="network-grid">
          {data?.map((network) => (
            <div className="network-card" key={network.id} data-testid={`card-network-${network.id}`}>
              <div className="network-head"><div className="chain-icon">{network.name.slice(0, 1)}</div><div><b>{network.name}</b><small>Chain {network.chainId}</small></div><span className={`status-pill ${network.status}`}><i />{network.status}</span></div>
              <div className="network-readings"><div><small>Block</small><b>{number(network.blockNumber)}</b></div><div><small>Gas</small><b>{network.gasGwei.toFixed(1)} <em>gwei</em></b></div><div><small>Tokens</small><b>{number(network.tokensScanned)}</b></div><div><small>Pools</small><b>{number(network.pools)}</b></div></div>
              <div className="network-foot"><span>{number(network.liquidPools)} liquid · {number(network.venues)} DEXs</span><span>{network.blockTimeMs}ms · {ago(network.lastBlockAt)}</span></div>
            </div>
          ))}
        </div>
      </DataState>
    </section>
  );
}

function Opportunities({
  data,
  loading,
  error,
  retry,
  onSelect,
  chain,
  onChainChange,
}: {
  data?: ArbitrageOpportunity[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  onSelect: (opportunity: ArbitrageOpportunity) => void;
  chain: GetScannerOpportunitiesChain;
  onChainChange: (chain: GetScannerOpportunitiesChain) => void;
}) {
  const [minBps, setMinBps] = useState('0');
  const filtered = useMemo(() => (data ?? []).filter((item) => item.spreadBps >= Number(minBps)), [data, minBps]);
  return (
    <section id="opportunities" className="section-block opportunities-section">
      <div className="section-heading heading-with-controls">
        <div><div className="eyebrow">Opportunity feed</div><h2>Executable dislocations <span className="count-badge">{filtered.length}</span></h2></div>
        <div className="filters">
          <div className="select-wrap"><Filter size={14} /><select value={chain} onChange={(event) => onChainChange(event.target.value as GetScannerOpportunitiesChain)} data-testid="select-chain-filter"><option value="all">All networks</option><option value="ethereum">Ethereum</option><option value="arbitrum">Arbitrum</option></select></div>
          <div className="select-wrap"><SlidersHorizontal size={14} /><select value={minBps} onChange={(event) => setMinBps(event.target.value)} data-testid="select-spread-filter"><option value="0">Any spread</option><option value="25">25+ bps</option><option value="50">50+ bps</option><option value="100">100+ bps</option></select></div>
        </div>
      </div>
      <DataState loading={loading} error={error} empty={!filtered.length} onRetry={retry} label="opportunities">
        <div className="table-shell">
          <div className="table-header"><span>Route / token</span><span>Spread</span><span>Execution venues</span><span>Net profit</span><span>Signal</span><span /></div>
          {filtered.map((item, index) => (
            <button className="opportunity-row" key={item.id} onClick={() => onSelect(item)} data-testid={`row-opportunity-${item.id}`}>
              <div className="route-cell"><div className="token-glyph">{item.token.slice(0, 2)}</div><div><strong>{item.token}</strong><small>{item.pair} · {item.chain}</small></div></div>
              <div className="spread-cell"><strong>{item.spreadPct.toFixed(2)}%</strong><small>{item.spreadBps} bps</small></div>
              <div className="venue-cell"><span>{item.buyVenue.name}</span><ArrowDownRight size={13} /><span>{item.sellVenue.name}</span></div>
              <div className="profit-cell"><strong>{money(item.profit.netProfitUsd)}</strong><small>on {money(item.profit.recommendedBorrowUsd, true)}</small></div>
              <div className="signal-cell"><span className={`exec-badge ${item.executable ? 'executable' : 'watching'}`}><i />{item.executable ? 'Executable' : 'Monitoring'}</span><small>{ago(item.detectedAt)}</small></div>
              <ChevronRight className="row-arrow" size={17} />
            </button>
          ))}
        </div>
        <div className="table-footer"><span><span className="live-dot" /> Streaming from {data?.length ?? 0} active routes</span><span>Sorted by net profit <ArrowDownRight size={13} /></span></div>
      </DataState>
    </section>
  );
}

function TokenUniverse({ data, loading, error, retry, coverage }: { data?: ScannerToken[]; loading: boolean; error: boolean; retry: () => void; coverage?: ScannerSummary }) {
  return (
    <section id="tokens" className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Coverage</div><h2>Token universe</h2></div><span className="section-note"><span className="live-dot" />{data?.length ?? 0} active assets · {coverage?.tokenListSource === 'uniswap' ? 'Uniswap verified list' : 'curated metadata'}</span></div>
      {coverage && (
        <div className="coverage-bar">
          <div><span>Discovery breadth</span><strong>{number(coverage.tokensDiscovered)} candidates</strong></div>
          <div><span>Active scan</span><strong>{number(coverage.tokensTracked)} tokens</strong></div>
          <div><span>Pool surface</span><strong>{number(coverage.poolsScanned)} pools</strong></div>
          <div><span>Snapshot</span><strong>{ago(coverage.lastScanAt)}</strong></div>
        </div>
      )}
      <DataState loading={loading} error={error} empty={!data?.length} onRetry={retry} label="tokens">
        <div className="token-grid">
          {data?.slice(0, 8).map((token) => (
            <div className="token-card" key={token.address} data-testid={`card-token-${token.symbol}`}>
              <div className="token-head"><div className="token-glyph large">{token.symbol.slice(0, 2)}</div><div><strong>{token.symbol}</strong><small>{token.name}</small></div><span className={token.change24h >= 0 ? 'positive' : 'negative'}>{token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%</span></div>
              <div className="token-price">{money(token.priceUsd, false)}</div>
              <div className="token-meta"><span>{money(token.liquidityUsd, true)} liq.</span><span>{token.pools} pools</span><span>{money(token.volume24h, true)} vol.</span></div>
            </div>
          ))}
        </div>
      </DataState>
    </section>
  );
}

function DetailDrawer({ selected, close }: { selected: ArbitrageOpportunity | null; close: () => void }) {
  const detail = useGetScannerOpportunity(selected?.id ?? '', { query: { enabled: Boolean(selected?.id), queryKey: getGetScannerOpportunityQueryKey(selected?.id ?? '') } });
  const item = detail.data ?? selected;
  if (!selected) return null;
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true">
      <button className="drawer-scrim" onClick={close} aria-label="Close opportunity detail" data-testid="button-close-detail" />
      <aside className="detail-drawer">
        <div className="drawer-head"><div><div className="eyebrow">Route detail</div><h2>{item?.token} / {item?.pair}</h2></div><button className="icon-button" onClick={close} aria-label="Close detail" data-testid="button-close-detail"><X size={18} /></button></div>
        {detail.isLoading ? <><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full mt-3" /></> : item ? (
          <>
            <div className="detail-highlight"><div><span>Net profit</span><strong>{money(item.profit.netProfitUsd)}</strong></div><div><span>Spread</span><strong>{item.spreadPct.toFixed(2)}%</strong><small>{item.spreadBps} basis points</small></div><span className={`exec-badge ${item.executable ? 'executable' : 'watching'}`}><i />{item.executable ? 'Executable' : 'Monitoring'}</span></div>
            <div className="route-visual"><div className="route-node"><span className="node-label">BUY</span><strong>{item.buyVenue.name}</strong><small>{money(item.buyVenue.priceUsd)} · {item.buyVenue.feeBps} bps fee</small></div><div className="route-line"><Zap size={14} /></div><div className="route-node sell"><span className="node-label">SELL</span><strong>{item.sellVenue.name}</strong><small>{money(item.sellVenue.priceUsd)} · {item.sellVenue.feeBps} bps fee</small></div></div>
            <div className="detail-block"><div className="detail-title">Profit estimate</div>{[['Gross profit', item.profit.grossProfitUsd], ['Flash loan fee', -item.profit.flashLoanFeeUsd], ['Gas cost', -item.profit.gasCostUsd], ['DEX fees', -item.profit.dexFeesUsd], ['Slippage', -item.profit.slippageUsd]].map(([label, value]) => <div className="detail-line" key={String(label)}><span>{label}</span><b className={Number(value) < 0 ? 'cost' : ''}>{Number(value) < 0 ? '−' : ''}{money(Math.abs(Number(value)))}</b></div>)}<div className="detail-line total"><span>Net profit</span><b>{money(item.profit.netProfitUsd)}</b></div></div>
            <div className="drawer-meta"><div><Clock3 size={14} /> Detected {ago(item.detectedAt)}</div><div><ShieldCheck size={14} /> Confidence: <b>{item.profit.confidence}</b></div><div><Activity size={14} /> Block {number(item.blockNumber)}</div></div>
            <div className="drawer-actions"><a className="button button-primary" href={item.buyVenue.dexUrl} target="_blank" rel="noreferrer" data-testid="link-open-buy-venue"><ExternalLink size={14} /> Open route</a><button className="button button-quiet" onClick={() => navigator.clipboard?.writeText(item.id)} data-testid="button-copy-opportunity"><Copy size={14} /> Copy ID</button></div>
          </>
        ) : <div className="state-box">Opportunity no longer available.</div>}
      </aside>
    </div>
  );
}

function Cockpit() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selected, setSelected] = useState<ArbitrageOpportunity | null>(null);
  const summary = useGetScannerSummary();
  const networks = useGetScannerNetworks();
  const tokens = useGetScannerTokens();
  const [chain, setChain] = useState<GetScannerOpportunitiesChain>('all');
  const opportunities = useGetScannerOpportunities({ chain, minProfitBps: 0, limit: 100 });
  const health = useHealthCheck();
  const client = useQueryClient();
  const refreshing = summary.isFetching || networks.isFetching || tokens.isFetching || opportunities.isFetching;
  const refresh = () => {
    client.invalidateQueries({ queryKey: getGetScannerSummaryQueryKey() });
    client.invalidateQueries({ queryKey: getGetScannerNetworksQueryKey() });
    client.invalidateQueries({ queryKey: getGetScannerTokensQueryKey() });
    client.invalidateQueries({ queryKey: getGetScannerOpportunitiesQueryKey() });
    client.invalidateQueries({ queryKey: getHealthCheckQueryKey() });
  };
  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileOpen} close={() => setMobileOpen(false)} />
      <main className="main-canvas">
        <Topbar onMenu={() => setMobileOpen(true)} onRefresh={refresh} refreshing={refreshing} />
        <div className="page-content">
          <div className="hero-row"><div><div className="eyebrow">Market intelligence / <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span></div><h1>Find the gap<br /><em>before it closes.</em></h1><p className="hero-copy">Cross-chain price intelligence for the moments that matter.</p></div><div className="health-chip" data-testid="status-health"><span className={`live-dot ${health.data?.status === 'ok' ? '' : health.isError ? 'offline' : ''}`} /><span>{health.data?.status === 'ok' ? 'All systems nominal' : health.isError ? 'API degraded' : 'Checking engine'}</span><small>UTC {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</small></div></div>
          <Summary loading={summary.isLoading} data={summary.data} />
          <NetworkStrip data={networks.data} loading={networks.isLoading} error={networks.isError} retry={() => networks.refetch()} />
          <Opportunities data={opportunities.data} loading={opportunities.isLoading} error={opportunities.isError} retry={() => opportunities.refetch()} onSelect={setSelected} chain={chain} onChainChange={setChain} />
          <TokenUniverse data={tokens.data} loading={tokens.isLoading} error={tokens.isError} retry={() => tokens.refetch()} coverage={summary.data} />
          <footer className="page-footer"><span>Arbitrage Scanner <b>·</b> Real-time market intelligence</span><span>Data refreshes automatically <span className="live-dot" /></span></footer>
        </div>
      </main>
      <DetailDrawer selected={selected} close={() => setSelected(null)} />
    </div>
  );
}

function Router() {
  return <Switch><Route path="/" component={Cockpit} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;