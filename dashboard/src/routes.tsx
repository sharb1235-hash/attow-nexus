import { createBrowserRouter } from "react-router-dom";

import { Home } from "./App";
import { ChannelDetail } from "./components/ChannelDetail";
import { CommitDetail } from "./components/CommitDetail";
import { CommitDiff } from "./components/CommitDiff";
import { ForkControls } from "./components/ForkControls";
import { Layout } from "./components/Layout";
import { LedgerPage } from "./components/LedgerView";
import { LoopWarnings } from "./components/LoopWarnings";
import { MetricsRoute } from "./components/MetricsPanel";
import { ReplayControls } from "./components/ReplayControls";
import { RollbackWarning } from "./components/RollbackWarning";
import { AgentBusView } from "./components/AgentBusView";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "bus", element: <AgentBusView /> },
      { path: "agents", element: <AgentBusView /> },
      { path: "channels", element: <ChannelDetail /> },
      { path: "channels/:channel", element: <ChannelDetail /> },
      { path: "ledger", element: <LedgerPage /> },
      { path: "runs/:runId", element: <LedgerPage /> },
      { path: "commits/:commitId", element: <CommitDetail /> },
      { path: "diff", element: <CommitDiff /> },
      { path: "replay", element: <ReplayControls /> },
      { path: "fork", element: <ForkControls /> },
      { path: "rollback", element: <RollbackWarning /> },
      { path: "loops", element: <LoopWarnings /> },
      { path: "metrics", element: <MetricsRoute /> }
    ]
  }
]);

