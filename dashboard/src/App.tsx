import { useEffect, useState } from "react";

import { api, ChannelInfo, CommitSummary, Health, MetricsSummary } from "./api";
import { AgentBusView } from "./components/AgentBusView";
import { AgentPresencePanel } from "./components/AgentPresencePanel";
import { ChannelList } from "./components/ChannelList";
import { LedgerView } from "./components/LedgerView";
import { LoopWarnings } from "./components/LoopWarnings";
import { MetricsPanel } from "./components/MetricsPanel";

export function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const [nextHealth, nextChannels, runs, nextMetrics] = await Promise.all([
        api.health(),
        api.channels().catch(() => []),
        api.runs().catch(() => []),
        api.metrics().catch(() => null)
      ]);
      setHealth(nextHealth);
      setChannels(nextChannels);
      setMetrics(nextMetrics);
      const firstRun = String(runs[0]?.runId ?? "");
      if (firstRun) {
        setCommits(await api.runCommits(firstRun).catch(() => []));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="view-grid">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Attow Nexus Console</p>
          <h1>Local agent coordination</h1>
          <p className="summary-line">
            {health?.status === "ok" ? "Daemon online" : "Daemon unreachable"} · {health?.protocolVersion ?? "nexus.v1"}
          </p>
        </div>
        <div className="badge-row">
          <span className={health?.localOnly ? "badge good" : "badge warn"}>
            {health?.localOnly ? "local-only mode" : "remote bind"}
          </span>
          <span className={health?.authRequired ? "badge good" : "badge warn"}>
            {health?.authRequired ? "auth required" : "dev auth disabled"}
          </span>
        </div>
      </section>
      <AgentPresencePanel />
      <ChannelList channels={channels} />
      <LedgerView commits={commits} />
      <LoopWarnings compact />
      {metrics ? <MetricsPanel metrics={metrics} /> : null}
      <AgentBusView compact />
    </main>
  );
}
