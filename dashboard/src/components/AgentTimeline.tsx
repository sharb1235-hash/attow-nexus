export function AgentTimeline({ commit }: { commit: Record<string, unknown> | null }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Agent timeline</h2>
        <span>{String(commit?.agentId ?? "")}</span>
      </header>
      <div className="timeline">
        <div className="timeline-item">
          <strong>{String(commit?.agentId ?? "agent")}</strong>
          <span>{String(commit?.summary ?? "No commit selected")}</span>
        </div>
      </div>
    </section>
  );
}

