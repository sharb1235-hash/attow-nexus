import { useEffect, useState } from "react";

import { api } from "../api";

export function LoopWarnings({ compact = false }: { compact?: boolean }) {
  const [warnings, setWarnings] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const load = () => api.loopWarnings().then(setWarnings).catch(() => setWarnings([]));
    load();
    const id = window.setInterval(load, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className={compact ? "panel" : "panel wide"}>
      <header className="panel-header">
        <h2>Loop warnings</h2>
        <span>{warnings.length}</span>
      </header>
      <div className="table">
        <div className="row head">
          <span>Severity</span>
          <span>Run</span>
          <span>Agent</span>
          <span>Stable commit</span>
        </div>
        {warnings.map((warning) => (
          <div className="row" key={String(warning.warningId)}>
            <span className="pill warn">{String(warning.severity)}</span>
            <span>{String(warning.runId)}</span>
            <span>{String(warning.agentId)}</span>
            <span>{String(warning.suggestedStableCommitId || "none")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

