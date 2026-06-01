export function BackpressurePanel({ dropped = 0 }: { dropped?: number }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Backpressure</h2>
        <span>{dropped}</span>
      </header>
      <div className="metric-line">
        <span>Dropped ephemeral messages</span>
        <strong>{dropped}</strong>
      </div>
    </section>
  );
}

