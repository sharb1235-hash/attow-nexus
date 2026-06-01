import { useEffect, useState } from "react";

import { AgentInfo, api, ChannelInfo, DeltaInfo, MetricsSummary } from "../api";
import { AgentPresencePanel } from "./AgentPresencePanel";
import { BackpressurePanel } from "./BackpressurePanel";
import { ChannelList } from "./ChannelList";
import { DeltaFeed } from "./DeltaFeed";

export function AgentBusView({ compact = false }: { compact?: boolean }) {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [deltas, setDeltas] = useState<DeltaInfo[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    const load = async () => {
      const [nextChannels, nextMetrics, nextAgents] = await Promise.all([
        api.channels().catch(() => []),
        api.metrics().catch(() => null),
        api.agents().catch(() => [])
      ]);
      setChannels(nextChannels);
      setMetrics(nextMetrics);
      setAgents(nextAgents);
      const first = nextChannels[0]?.name;
      if (first) {
        setDeltas(await api.channelDeltas(first).catch(() => []));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (compact) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Agent bus</h2>
          <span>{agents.length} agents</span>
        </header>
        <div className="metric-grid">
          <div><strong>{channels.length}</strong><span>channels</span></div>
          <div><strong>{metrics?.nexus_deltas_total ?? 0}</strong><span>deltas</span></div>
          <div><strong>{metrics?.nexus_backpressure_events_total ?? 0}</strong><span>pressure</span></div>
        </div>
      </section>
    );
  }

  return (
    <main className="view-grid">
      <AgentPresencePanel />
      <ChannelList channels={channels} />
      <DeltaFeed deltas={deltas} />
      <BackpressurePanel dropped={metrics?.nexus_dropped_ephemeral_total ?? 0} />
    </main>
  );
}

