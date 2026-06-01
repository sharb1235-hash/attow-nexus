import { Link } from "react-router-dom";

import { CommitSummary } from "../api";

export function CommitGraph({ commits }: { commits: CommitSummary[] }) {
  return (
    <div className="graph">
      {commits.map((commit) => (
        <Link className="commit-node" key={commit.commitId} to={`/commits/${commit.commitId}`}>
          <span>{commit.commitId.slice(0, 10)}</span>
          <strong>{commit.channel}</strong>
          <em>{commit.summary || "state delta"}</em>
        </Link>
      ))}
    </div>
  );
}

