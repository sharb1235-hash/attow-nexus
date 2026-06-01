import { Link } from "react-router-dom";

import { ChannelInfo } from "../api";

export function ChannelList({ channels }: { channels: ChannelInfo[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Active channels</h2>
        <span>{channels.length}</span>
      </header>
      <div className="table">
        <div className="row head">
          <span>Channel</span>
          <span>Durable</span>
          <span>Ephemeral</span>
          <span>Publishers</span>
        </div>
        {channels.map((channel) => (
          <div className="row" key={channel.name}>
            <Link to={`/channels/${encodeURIComponent(channel.name)}`}>{channel.name}</Link>
            <span>{channel.durable_count}</span>
            <span>{channel.ephemeral_count}</span>
            <span>{channel.publishers.join(", ") || "none"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

