import { useState } from "react";

import { api } from "../api";

export function RollbackWarning() {
  const [head, setHead] = useState("");
  const [target, setTarget] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (head && target && confirmed) {
      setResult(await api.rollback(head, target, false));
    }
  };

  return (
    <main className="view-grid">
      <section className="panel wide warning-panel">
        <header className="panel-header">
          <h2>Rollback captured state</h2>
          <button disabled={!confirmed} onClick={() => void run()}>Execute rollback</button>
        </header>
        <p>Rollback moves a NexusLedger head pointer. External side effects remain logged as irreversible unless an adapter supplies a compensating action.</p>
        <div className="control-row">
          <input value={head} onChange={(event) => setHead(event.target.value)} placeholder="current head commit" />
          <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="target commit" />
          <label className="check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirm</label>
        </div>
        <pre>{JSON.stringify(result ?? {}, null, 2)}</pre>
      </section>
    </main>
  );
}

