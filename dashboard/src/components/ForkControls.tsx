import { useState } from "react";

import { api } from "../api";

export function ForkControls() {
  const [commitId, setCommitId] = useState("");
  const [newRunId, setNewRunId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (commitId) {
      setResult(await api.fork(commitId, newRunId));
    }
  };

  return (
    <main className="view-grid">
      <section className="panel wide">
        <header className="panel-header">
          <h2>Fork</h2>
          <button onClick={() => void run()}>Create fork</button>
        </header>
        <div className="control-row">
          <input value={commitId} onChange={(event) => setCommitId(event.target.value)} placeholder="source commit" />
          <input value={newRunId} onChange={(event) => setNewRunId(event.target.value)} placeholder="new run id" />
        </div>
        <pre>{JSON.stringify(result ?? {}, null, 2)}</pre>
        <code>nexus fork {commitId || "&lt;commit_id&gt;"} --new-run {newRunId || "&lt;run_id&gt;"}</code>
      </section>
    </main>
  );
}

