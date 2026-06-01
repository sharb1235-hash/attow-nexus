import { useEffect, useState } from "react";

import { api, MetricsSummary } from "../api";

export function MetricsPanel({ metrics }: { metrics: MetricsSummary }) {
  const items = Object.entries(metrics);
  return (
    <section className="panel wide">
      <header className="panel-header">
        <h2>Metrics</h2>
        <span>{items.length}</span>
      </header>
      <div className="metric-grid">
        {items.map(([key, value]) => (
          <div key={key}>
            <strong>{value}</strong>
            <span>{key.replace("nexus_", "").replaceAll("_", " ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MetricsRoute() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  useEffect(() => {
    const load = () => api.metrics().then(setMetrics).catch(() => setMetrics(null));
    load();
    const id = window.setInterval(load, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <main className="view-grid">{metrics ? <MetricsPanel metrics={metrics} /> : null}</main>;
}
