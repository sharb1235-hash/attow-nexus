import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ChannelInfo, DeltaInfo } from "../api";
import { ChannelList } from "./ChannelList";
import { DeltaFeed } from "./DeltaFeed";

export function ChannelDetail() {
  const params = useParams();
  const channel = params.channel ? decodeURIComponent(params.channel) : "";
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [deltas, setDeltas] = useState<DeltaInfo[]>([]);

  useEffect(() => {
    const load = async () => {
      const nextChannels = await api.channels().catch(() => []);
      setChannels(nextChannels);
      const selected = channel || nextChannels[0]?.name || "";
      if (selected) {
        setSnapshot(await api.channelSnapshot(selected).catch(() => null));
        setDeltas(await api.channelDeltas(selected).catch(() => []));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(id);
  }, [channel]);

  return (
    <main className="view-grid">
      <ChannelList channels={channels} />
      <section className="panel wide">
        <header className="panel-header">
          <h2>{String(snapshot?.channel ?? (channel || "Channel"))}</h2>
          <span>{String(snapshot?.durableCount ?? 0)} durable</span>
        </header>
        <pre>{JSON.stringify(snapshot?.latestPayload ?? {}, null, 2)}</pre>
      </section>
      <DeltaFeed deltas={deltas} />
    </main>
  );
}
