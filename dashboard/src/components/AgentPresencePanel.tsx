import { useEffect, useState } from "react";

import { AgentInfo, api } from "../api";

export function AgentPresencePanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    const load = () => api.agents().then(setAgents).catch(() => setAgents([]));
    load();
    const id = window.setInterval(load, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Connected agents</h2>
        <span>{agents.length}</span>
      </header>
      <div className="table">
        <div className="row head">
          <span>Agent</span>
          <span>Framework</span>
          <span>Language</span>
          <span>Status</span>
        </div>
        {agents.map((agent) => (
          <div className="row" key={agent.agent_id}>
            <span>{agent.agent_id}</span>
            <span>{agent.framework || "custom"}</span>
            <span>{agent.language || "unknown"}</span>
            <span className={agent.status === "online" ? "status good-text" : "status"}>{agent.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

