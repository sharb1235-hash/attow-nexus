import { DeltaInfo } from "../api";

export function DeltaFeed({ deltas }: { deltas: DeltaInfo[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Recent broadcasts</h2>
        <span>{deltas.length}</span>
      </header>
      <div className="timeline">
        {deltas.map((delta) => (
          <div className="timeline-item" key={delta.delta_id}>
            <span className={delta.durable ? "pill durable" : "pill ephemeral"}>
              {delta.durable ? "durable" : "ephemeral"}
            </span>
            <strong>{delta.channel}</strong>
            <span>{delta.summary || delta.delta_id}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

