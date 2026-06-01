import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api";
import { AgentTimeline } from "./AgentTimeline";
import { ToolCallInspector } from "./ToolCallInspector";

export function CommitDetail() {
  const { commitId } = useParams();
  const [commit, setCommit] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (commitId) {
      void api.commit(commitId).then(setCommit).catch(() => setCommit(null));
    }
  }, [commitId]);

  return (
    <main className="view-grid">
      <section className="panel wide">
        <header className="panel-header">
          <h2>{String(commit?.commitId ?? "Commit")}</h2>
          <span>{String(commit?.channel ?? "")}</span>
        </header>
        <pre>{JSON.stringify(commit?.stateDelta ?? {}, null, 2)}</pre>
      </section>
      <ToolCallInspector commit={commit} />
      <AgentTimeline commit={commit} />
    </main>
  );
}

