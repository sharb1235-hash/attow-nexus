import { renderToString } from "react-dom/server";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Home } from "./App";
import { AgentBusView } from "./components/AgentBusView";
import { ChannelDetail } from "./components/ChannelDetail";
import { CommitDetail } from "./components/CommitDetail";
import { CommitDiff } from "./components/CommitDiff";
import { ForkControls } from "./components/ForkControls";
import { LedgerPage } from "./components/LedgerView";
import { LoopWarnings } from "./components/LoopWarnings";
import { MetricsPanel } from "./components/MetricsPanel";
import { ReplayControls } from "./components/ReplayControls";
import { RollbackWarning } from "./components/RollbackWarning";

function renderWithRouter(element: React.ReactElement, path = "/") {
  return renderToString(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

describe("dashboard route smoke tests", () => {
  it("renders the home shell", () => {
    const html = renderWithRouter(<Home />);
    expect(html).toContain("Local agent coordination");
    expect(html).toContain("Attow Nexus Console");
  });

  it("renders the bus shell", () => {
    const html = renderWithRouter(<AgentBusView />);
    expect(html).toContain("Connected agents");
    expect(html).toContain("Active channels");
  });

  it("renders the channel route shell", () => {
    const html = renderWithRouter(
      <Routes>
        <Route path="/channels/:channel" element={<ChannelDetail />} />
      </Routes>,
      "/channels/topic%3Aplan"
    );
    expect(html).toContain("Active channels");
    expect(html).toContain("topic:plan");
  });

  it("renders the ledger route shell", () => {
    const html = renderWithRouter(
      <Routes>
        <Route path="/ledger" element={<LedgerPage />} />
      </Routes>,
      "/ledger"
    );
    expect(html).toContain("Runs");
    expect(html).toContain("Recent commits");
  });

  it("renders the commit detail route shell", () => {
    const html = renderWithRouter(
      <Routes>
        <Route path="/commits/:commitId" element={<CommitDetail />} />
      </Routes>,
      "/commits/c_demo"
    );
    expect(html).toContain("Commit");
    expect(html).toContain("Tool calls");
  });

  it("renders operator action route shells", () => {
    expect(renderWithRouter(<CommitDiff />)).toContain("Diff commits");
    expect(renderWithRouter(<ReplayControls />)).toContain("Replay");
    expect(renderWithRouter(<ForkControls />)).toContain("Fork");
    expect(renderWithRouter(<RollbackWarning />)).toContain("Rollback captured state");
    expect(renderWithRouter(<LoopWarnings />)).toContain("Loop warnings");
  });

  it("renders metrics with mocked API fixture data", () => {
    const html = renderToString(
      <MetricsPanel
        metrics={{
          nexus_agents_connected: 2,
          nexus_channels_total: 2,
          nexus_subscriptions_total: 0,
          nexus_commits_total: 2,
          nexus_ephemeral_deltas_total: 0,
          nexus_durable_deltas_total: 2,
          nexus_deltas_total: 2,
          nexus_loop_warnings_total: 0,
          nexus_backpressure_events_total: 0,
          nexus_dropped_ephemeral_total: 0,
          nexus_artifacts_total: 1,
          nexus_errors_total: 0,
          nexus_memory_bytes: 0
        }}
      />
    );
    expect(html).toContain("Metrics");
    expect(html).toContain("agents connected");
    expect(html).toContain("commits total");
  });
});
