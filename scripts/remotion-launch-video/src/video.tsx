import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const teal = "#5fffe4";
const mint = "#9cffd8";
const blue = "#8fd7ff";
const ink = "#050807";
const panel = "rgba(6, 18, 17, 0.88)";
const border = "rgba(95, 255, 228, 0.28)";

type SceneProps = {
  from: number;
  duration: number;
  children: React.ReactNode;
};

export const AttowNexusLaunch = () => {
  const fps = 30;
  return (
    <AbsoluteFill style={{ background: ink, color: "#f2fff9", fontFamily: "Inter, Segoe UI, Arial, sans-serif" }}>
      <Background />
      <Sequence from={0} durationInFrames={6 * fps} premountFor={fps}>
        <ProblemScene />
      </Sequence>
      <Sequence from={6 * fps} durationInFrames={5 * fps} premountFor={fps}>
        <ProductScene />
      </Sequence>
      <Sequence from={11 * fps} durationInFrames={8 * fps} premountFor={fps}>
        <DockerScene />
      </Sequence>
      <Sequence from={19 * fps} durationInFrames={8 * fps} premountFor={fps}>
        <HealthScene />
      </Sequence>
      <Sequence from={27 * fps} durationInFrames={9 * fps} premountFor={fps}>
        <PythonDemoScene />
      </Sequence>
      <Sequence from={36 * fps} durationInFrames={8 * fps} premountFor={fps}>
        <MetricsScene />
      </Sequence>
      <Sequence from={44 * fps} durationInFrames={9 * fps} premountFor={fps}>
        <CliScene />
      </Sequence>
      <Sequence from={53 * fps} durationInFrames={5 * fps} premountFor={fps}>
        <ConsoleScene />
      </Sequence>
      <Sequence from={58 * fps} durationInFrames={2 * fps} premountFor={fps}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};

const Background = () => {
  const frame = useCurrentFrame();
  const drift = frame * 0.24;
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 22% 18%, rgba(14, 107, 91, 0.34), transparent 30%), radial-gradient(circle at 78% 68%, rgba(26, 105, 126, 0.26), transparent 34%), linear-gradient(135deg, #020303 0%, #061211 45%, #020607 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(95,255,228,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(95,255,228,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          transform: `translate(${-(drift % 64)}px, ${-(drift % 64)}px)`,
        }}
      />
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        <NodeLine x1={160} y1={820} x2={540} y2={610} delay={0} />
        <NodeLine x1={540} y1={610} x2={980} y2={710} delay={20} />
        <NodeLine x1={980} y1={710} x2={1390} y2={460} delay={40} />
        <NodeLine x1={430} y1={220} x2={870} y2={330} delay={10} />
        <NodeLine x1={870} y1={330} x2={1510} y2={250} delay={30} />
      </svg>
    </AbsoluteFill>
  );
};

const NodeLine = ({ x1, y1, x2, y2, delay }: { x1: number; y1: number; x2: number; y2: number; delay: number }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 60], [0.08, 0.56], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={teal} strokeWidth={2} />
      <circle cx={x1} cy={y1} r={7} fill={teal} />
      <circle cx={x2} cy={y2} r={7} fill={blue} />
    </g>
  );
};

const Scene = ({ from, duration, children }: SceneProps) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from, from + 18, from + duration - 18, from + duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const y = interpolate(frame, [from, from + 24], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${y}px)`, padding: 96 }}>
      {children}
    </AbsoluteFill>
  );
};

const ProblemScene = () => (
  <Scene from={0} duration={180}>
    <div style={{ marginTop: 210, maxWidth: 1280 }}>
      <Kicker>Local-first agent state coordination</Kicker>
      <h1 style={h1}>AI agents are getting harder to debug.</h1>
      <p style={subhead}>State spreads across tools, frameworks, processes, and long-running workflows.</p>
      <p style={caption}>When something breaks, developers need to know what changed, where, and why.</p>
    </div>
  </Scene>
);

const ProductScene = () => (
  <Scene from={0} duration={150}>
    <div style={{ marginTop: 150 }}>
      <h1 style={{ ...h1, color: "#ffffff", textShadow: `0 0 36px ${teal}` }}>Attow Nexus</h1>
      <p style={{ ...subhead, color: mint, fontSize: 50, marginTop: 18 }}>Git for AI agent state.</p>
      <p style={{ ...caption, maxWidth: 1000, fontSize: 30 }}>
        Local coordination daemon + Git-like ledger for polyglot AI agents.
      </p>
      <div style={{ display: "flex", gap: 18, marginTop: 52 }}>
        <Badge>local-first</Badge>
        <Badge>open-source</Badge>
        <Badge>developer preview</Badge>
      </div>
    </div>
  </Scene>
);

const DockerScene = () => (
  <Scene from={0} duration={240}>
    <Split
      left={
        <>
          <Kicker>Docker runtime</Kicker>
          <h2 style={h2}>Start the local daemon</h2>
          <p style={body}>A background process accepts agent state locally and exposes API, gRPC, and metrics endpoints.</p>
          <div style={{ display: "flex", gap: 14, marginTop: 32 }}>
            <Badge>local daemon</Badge>
            <Badge>no cloud required</Badge>
          </div>
          <p style={note}>Host ports are published to 127.0.0.1 in the local Compose setup.</p>
        </>
      }
      right={
        <Terminal
          title="Docker daemon"
          lines={[
            ["$ docker compose up --build", "cmd"],
            ["", ""],
            ["Nexus daemon listening locally:", "ok"],
            ["gRPC    0.0.0.0:7821", ""],
            ["HTTP    0.0.0.0:7822", ""],
            ["metrics 0.0.0.0:7823", ""],
          ]}
        />
      }
    />
  </Scene>
);

const HealthScene = () => (
  <Scene from={0} duration={240}>
    <Split
      left={
        <>
          <Kicker>API health check</Kicker>
          <h2 style={h2}>A versioned local API</h2>
          <p style={body}>The daemon exposes a local HTTP API for agent state coordination and dashboard reads.</p>
          <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
            <Badge>status ok</Badge>
            <Badge>protocolVersion nexus.v1</Badge>
            <Badge>daemonVersion 0.1.0</Badge>
          </div>
        </>
      }
      right={
        <Terminal
          title="API health check"
          lines={[
            ["$ curl.exe http://127.0.0.1:7822/api/health", "cmd"],
            ["", ""],
            ["{", ""],
            ['  "status": "ok",', "ok"],
            ['  "daemonVersion": "0.1.0",', ""],
            ['  "protocolVersion": "nexus.v1",', "ok"],
            ['  "authRequired": false,', ""],
            ['  "bindMode": "tcp"', ""],
            ["}", ""],
          ]}
        />
      }
    />
  </Scene>
);

const PythonDemoScene = () => (
  <Scene from={0} duration={270}>
    <Split
      left={
        <>
          <Kicker>Python SDK demo</Kicker>
          <h2 style={h2}>Durable commits for agent workflows</h2>
          <MiniFlow />
          <p style={note}>Two local agents publish durable state. No external API key required.</p>
        </>
      }
      right={
        <Terminal
          title="Python SDK demo"
          lines={[
            ["$ py examples\\python-basic\\main.py", "cmd"],
            ["", ""],
            ["created commits:", "ok"],
            ["c_fb4b5bb2d7051bc3cdcb7e7f0ad08b69", "hash"],
            ["c_381eba00e5c5d23a723e17fa41927e3d", "hash"],
            ["", ""],
            ["try:", ""],
            ["nexus diff c_fb4b... c_381e...", "cmd"],
            ["nexus replay c_381e...", "cmd"],
          ]}
        />
      }
    />
  </Scene>
);

const MetricsScene = () => {
  const frame = useCurrentFrame();
  const n = Math.round(
    interpolate(frame, [24, 92], [0, 2], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  );
  return (
    <Scene from={0} duration={240}>
      <Split
        left={
          <>
            <Kicker>Prometheus metrics</Kicker>
            <h2 style={h2}>Runtime state you can inspect</h2>
            <p style={body}>The bus and ledger are live. Metrics update as agents commit state.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 190px)", gap: 16, marginTop: 34 }}>
              <MetricChip value={n} label="agents" />
              <MetricChip value={n} label="channels" />
              <MetricChip value={n} label="durable deltas" />
              <MetricChip value={n} label="commits" />
            </div>
          </>
        }
        right={
          <Terminal
            title="Metrics after the demo"
            lines={[
              ["$ curl.exe http://127.0.0.1:7823/metrics", "cmd"],
              ["", ""],
              [`nexus_agents_connected ${n}`, "ok"],
              [`nexus_channels_total ${n}`, "ok"],
              [`nexus_deltas_total ${n}`, "ok"],
              [`nexus_durable_deltas_total ${n}`, "ok"],
              [`nexus_commits_total ${n}`, "ok"],
            ]}
          />
        }
      />
    </Scene>
  );
};

const CliScene = () => (
  <Scene from={0} duration={270}>
    <Split
      left={
        <>
          <Kicker>CLI inspection</Kicker>
          <h2 style={h2}>Inspect, diff, replay, and debug</h2>
          <p style={body}>Use the CLI to see agents, channels, commits, and run history from local state.</p>
          <p style={note}>The same captured logical state powers diffs and replay.</p>
        </>
      }
      right={
        <Terminal
          title="CLI inspection"
          lines={[
            ["$ nexus agents", "cmd"],
            ["planner", "ok"],
            ["researcher", "ok"],
            ["", ""],
            ["$ nexus channels", "cmd"],
            ["topic:plan", "hash"],
            ["topic:research", "hash"],
            ["", ""],
            ["$ nexus log --run demo-run", "cmd"],
            ["Planner published a plan", "ok"],
            ["Researcher added revenue finding", "ok"],
            ["", ""],
            ["$ nexus diff ...", "cmd"],
            ["$ nexus replay ...", "cmd"],
          ]}
        />
      }
    />
  </Scene>
);

const ConsoleScene = () => (
  <Scene from={0} duration={150}>
    <div style={{ display: "flex", alignItems: "center", gap: 52, height: "100%" }}>
      <div style={{ flex: 0.78 }}>
        <Kicker>Nexus Console</Kicker>
        <h2 style={h2}>Live agent bus + ledger observability</h2>
        <p style={body}>A local console for seeing what your agents are doing.</p>
      </div>
      <DashboardMock />
    </div>
  </Scene>
);

const ClosingScene = () => (
  <Scene from={0} duration={60}>
    <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center" }}>
      <div>
        <h1 style={{ ...h1, fontSize: 92, textShadow: `0 0 38px ${teal}`, marginBottom: 10 }}>Attow Nexus</h1>
        <p style={{ ...subhead, color: mint, fontSize: 38 }}>Not another agent framework.</p>
        <p style={{ ...caption, fontSize: 30 }}>The shared state and debugging substrate underneath them.</p>
        <p style={{ ...note, marginTop: 38 }}>github.com/sharb1235-hash/attow-nexus · Open-source developer preview</p>
      </div>
    </div>
  </Scene>
);

const Split = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "0.82fr 1.18fr", gap: 56, alignItems: "center", height: "100%" }}>
    <div>{left}</div>
    <div>{right}</div>
  </div>
);

const Terminal = ({ title, lines }: { title: string; lines: Array<[string, string]> }) => (
  <div
    style={{
      background: panel,
      border: `1px solid ${border}`,
      borderRadius: 18,
      boxShadow: "0 30px 90px rgba(0,0,0,0.45), 0 0 44px rgba(95,255,228,0.12)",
      overflow: "hidden",
      minHeight: 500,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "18px 22px",
        borderBottom: `1px solid ${border}`,
        color: "#dffdf4",
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      <Dot color="#ff6b6b" />
      <Dot color="#ffd166" />
      <Dot color="#4ee28a" />
      <span style={{ marginLeft: 12 }}>{title}</span>
    </div>
    <pre
      style={{
        margin: 0,
        padding: 30,
        fontFamily: "Consolas, Cascadia Mono, Menlo, monospace",
        fontSize: 26,
        lineHeight: 1.44,
        color: "#eafff8",
        whiteSpace: "pre-wrap",
      }}
    >
      {lines.map(([line, kind], index) => (
        <span key={`${line}-${index}`} style={{ color: lineColor(kind), textShadow: kind ? `0 0 16px ${lineColor(kind)}55` : "none" }}>
          {line}
          {"\n"}
        </span>
      ))}
    </pre>
  </div>
);

const DashboardMock = () => (
  <div
    style={{
      width: 1040,
      background: "rgba(5, 16, 16, 0.94)",
      border: `1px solid ${border}`,
      borderRadius: 20,
      boxShadow: "0 32px 100px rgba(0,0,0,0.52), 0 0 60px rgba(95,255,228,0.12)",
      padding: 28,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
      <div>
        <div style={{ color: mint, fontSize: 21, textTransform: "uppercase", letterSpacing: 2 }}>Attow Nexus Console</div>
        <div style={{ fontSize: 38, fontWeight: 800 }}>Live agent bus + ledger observability</div>
      </div>
      <Badge>local-only mode</Badge>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 18 }}>
      <PanelStat label="Connected agents" value="2" />
      <PanelStat label="Active channels" value="2" />
      <PanelStat label="Recent commits" value="2" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 16 }}>
      <MiniPanel title="Agents" rows={["planner · python", "researcher · python"]} />
      <MiniPanel title="Channels" rows={["topic:plan", "topic:research"]} />
      <MiniPanel
        title="Recent commits"
        rows={["Planner published a plan", "Researcher added revenue finding"]}
        wide
      />
    </div>
  </div>
);

const MiniFlow = () => (
  <div style={{ marginTop: 44, display: "grid", gap: 16, maxWidth: 690 }}>
    <FlowRow left="Planner" mid="topic:plan" right="NexusLedger" />
    <FlowRow left="Researcher" mid="topic:research" right="NexusLedger" />
  </div>
);

const FlowRow = ({ left, mid, right }: { left: string; mid: string; right: string }) => (
  <div style={{ display: "grid", gridTemplateColumns: "170px 40px 220px 40px 190px", alignItems: "center", gap: 8 }}>
    <FlowChip>{left}</FlowChip>
    <Arrow />
    <FlowChip>{mid}</FlowChip>
    <Arrow />
    <FlowChip>{right}</FlowChip>
  </div>
);

const Arrow = () => <div style={{ color: teal, fontSize: 34, textAlign: "center" }}>→</div>;

const FlowChip = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      border: `1px solid ${border}`,
      background: "rgba(8, 30, 27, 0.78)",
      borderRadius: 12,
      padding: "14px 16px",
      fontSize: 22,
      fontFamily: "Consolas, Cascadia Mono, monospace",
      color: "#eafff8",
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

const PanelStat = ({ label, value }: { label: string; value: string }) => (
  <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 18, background: "rgba(9, 34, 31, 0.7)" }}>
    <div style={{ color: teal, fontSize: 40, fontWeight: 900 }}>{value}</div>
    <div style={{ color: "#ccece5", fontSize: 20 }}>{label}</div>
  </div>
);

const MiniPanel = ({ title, rows, wide = false }: { title: string; rows: string[]; wide?: boolean }) => (
  <div
    style={{
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: 18,
      background: "rgba(3, 14, 14, 0.76)",
      gridColumn: wide ? "1 / 3" : undefined,
    }}
  >
    <div style={{ color: mint, fontSize: 21, fontWeight: 800, marginBottom: 10 }}>{title}</div>
    {rows.map((row) => (
      <div key={row} style={{ fontFamily: "Consolas, Cascadia Mono, monospace", fontSize: 21, color: "#eafff8", padding: "7px 0" }}>
        {row}
      </div>
    ))}
  </div>
);

const MetricChip = ({ value, label }: { value: number; label: string }) => (
  <div
    style={{
      border: `1px solid ${border}`,
      borderRadius: 14,
      background: "rgba(7, 28, 25, 0.78)",
      padding: "16px 18px",
      minHeight: 104,
    }}
  >
    <div style={{ fontSize: 46, fontWeight: 900, color: teal }}>{value}</div>
    <div style={{ fontSize: 21, color: "#d7fff5" }}>{label}</div>
  </div>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      border: `1px solid ${border}`,
      background: "rgba(8, 35, 31, 0.72)",
      color: mint,
      borderRadius: 999,
      padding: "10px 18px",
      fontSize: 22,
      fontWeight: 800,
      boxShadow: "0 0 24px rgba(95,255,228,0.08)",
    }}
  >
    {children}
  </div>
);

const Dot = ({ color }: { color: string }) => <span style={{ width: 14, height: 14, borderRadius: 99, background: color }} />;

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: teal, fontSize: 24, fontWeight: 900, letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 18 }}>
    {children}
  </div>
);

const lineColor = (kind: string) => {
  if (kind === "cmd") return blue;
  if (kind === "ok") return mint;
  if (kind === "hash") return teal;
  return "#f2fff9";
};

const h1: React.CSSProperties = {
  fontSize: 82,
  lineHeight: 1.04,
  letterSpacing: 0,
  margin: 0,
  fontWeight: 900,
};

const h2: React.CSSProperties = {
  fontSize: 58,
  lineHeight: 1.06,
  letterSpacing: 0,
  margin: 0,
  fontWeight: 900,
  maxWidth: 760,
};

const subhead: React.CSSProperties = {
  fontSize: 39,
  lineHeight: 1.2,
  letterSpacing: 0,
  color: "#d7fff5",
  marginTop: 28,
  marginBottom: 0,
  maxWidth: 1180,
};

const body: React.CSSProperties = {
  fontSize: 31,
  lineHeight: 1.32,
  letterSpacing: 0,
  color: "#d6f7ef",
  maxWidth: 760,
};

const caption: React.CSSProperties = {
  fontSize: 27,
  lineHeight: 1.34,
  color: "#b5d9d0",
  marginTop: 48,
  maxWidth: 1040,
};

const note: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.36,
  color: "#9fbbb5",
  marginTop: 36,
  maxWidth: 760,
};
