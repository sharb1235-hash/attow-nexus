import { useState } from "react";

import { api } from "../api";

export function CommitDiff() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (from && to) {
      setDiff(await api.diff(from, to));
    }
  };

  return (
    <main className="view-grid">
      <section className="panel wide">
        <header className="panel-header">
          <h2>Diff commits</h2>
          <button onClick={() => void run()}>Run diff</button>
        </header>
        <div className="control-row">
          <input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="from commit" />
          <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="to commit" />
        </div>
        <pre>{JSON.stringify(diff ?? {}, null, 2)}</pre>
        <code>nexus diff {from || "&lt;commit_a&gt;"} {to || "&lt;commit_b&gt;"}</code>
      </section>
    </main>
  );
}

