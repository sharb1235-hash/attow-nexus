import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, CommitSummary } from "../api";
import { CommitGraph } from "./CommitGraph";

export function LedgerView({ commits }: { commits: CommitSummary[] }) {
  return (
    <section className="panel wide">
      <header className="panel-header">
        <h2>Recent commits</h2>
        <span>{commits.length}</span>
      </header>
      <CommitGraph commits={commits} />
    </section>
  );
}

export function LedgerPage() {
  const { runId } = useParams();
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [commits, setCommits] = useState<CommitSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      const nextRuns = await api.runs().catch(() => []);
      setRuns(nextRuns);
      const selected = runId || String(nextRuns[0]?.runId ?? "");
      if (selected) {
        setCommits(await api.runCommits(selected).catch(() => []));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(id);
  }, [runId]);

  return (
    <main className="view-grid">
      <section className="panel">
        <header className="panel-header">
          <h2>Runs</h2>
          <span>{runs.length}</span>
        </header>
        <div className="list">
          {runs.map((run) => (
            <Link key={String(run.runId)} to={`/runs/${String(run.runId)}`}>
              {String(run.runId)} · {String(run.commitCount)} commits
            </Link>
          ))}
        </div>
      </section>
      <LedgerView commits={commits} />
    </main>
  );
}

