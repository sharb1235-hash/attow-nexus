import { useState } from "react";

import { api } from "../api";

export function ReplayControls() {
  const [commitId, setCommitId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (commitId) {
      setResult(await api.replay(commitId));
    }
  };

  return (
    <main className="view-grid">
      <section className="panel wide">
        <header className="panel-header">
          <h2>Replay</h2>
          <button onClick={() => void run()}>Replay state</button>
        </header>
        <div className="control-row">
          <input value={commitId} onChange={(event) => setCommitId(event.target.value)} placeholder="commit id" />
        </div>
        <pre>{JSON.stringify(result ?? {}, null, 2)}</pre>
        <code>nexus replay {commitId || "&lt;commit_id&gt;"}</code>
      </section>
    </main>
  );
}

