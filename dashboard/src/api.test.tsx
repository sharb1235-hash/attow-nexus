import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentPresencePanel } from "./components/AgentPresencePanel";

describe("dashboard views", () => {
  it("renders the agent panel shell", () => {
    const html = renderToString(<AgentPresencePanel />);
    expect(html).toContain("Connected agents");
  });
});

