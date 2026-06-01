export function ToolCallInspector({ commit }: { commit: Record<string, unknown> | null }) {
  const calls = Array.isArray(commit?.toolCalls) ? commit.toolCalls : [];
  const results = Array.isArray(commit?.toolResults) ? commit.toolResults : [];
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Tool calls</h2>
        <span>{calls.length}</span>
      </header>
      <pre>{JSON.stringify({ calls, results }, null, 2)}</pre>
    </section>
  );
}

