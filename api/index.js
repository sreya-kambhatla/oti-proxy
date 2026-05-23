import React from 'react';

function AIQuery({ onApplyFilters, allLogs }) {
  const [query,   setQuery]   = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error,   setError]   = React.useState("");
  const [lastQ,   setLastQ]   = React.useState("");

  const suggestions = [
    "Show critical OTIs",
    "Who hasn't logged this week?",
    "Blocked OTIs only",
    "Sreya's workload",
  ];

  async function handleAsk() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");

    const assignees  = [...new Set(allLogs.map(l => l.assignee))];
    const otiIds     = [...new Set(allLogs.map(l => l.otiId))];
    const statuses   = ["In Progress", "Completed", "Blocked"];
    const priorities = ["Low", "Medium", "High", "XXL", "Critical"];
    const dates      = allLogs.map(l => l.date).sort();
    const dateFrom   = dates[0];
    const dateTo     = dates[dates.length - 1];
    const today      = new Date().toISOString().slice(0, 10);
    const thisWeekStart = (() => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return d.toISOString().slice(0, 10);
    })();

    const systemPrompt = `You are a filter assistant for a team OTI tracking dashboard.
Given a natural language query, return a JSON filter object with these exact keys:
{ "search": "", "assignee": "", "status": "", "priority": "", "month": "", "year": "" }

Rules:
- "search" is a text string to match against OTI ID, title, or assignee name
- "assignee" must exactly match one of: ${assignees.join(", ")} — or empty string for all
- "status" must be one of: ${statuses.join(", ")} — or empty string for all
- "priority" must be one of: ${priorities.join(", ")} — or empty string for all
- "month" must be a zero-padded month number like "05" for May — or empty string for all
- "year" must be a 4-digit year string like "2026" — or empty string for all
- Return ONLY valid JSON, no explanation, no markdown, no backticks
- If the query mentions "this week" use month "${thisWeekStart.slice(5,7)}" and year "${thisWeekStart.slice(0,4)}"
- If the query mentions "today" use month "${today.slice(5,7)}" and year "${today.slice(0,4)}"
- If you cannot determine a filter value leave it as empty string

Available data: ${otiIds.length} OTIs, date range ${dateFrom} to ${dateTo}, assignees: ${assignees.join(", ")}`;

    try {
      const response = await fetch("https://oti-proxy.vercel.app/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: "user", content: query }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error("Proxy error " + response.status + ": " + (errData.error || response.statusText));
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      let filters;
      try {
        filters = JSON.parse(text.trim());
      } catch {
        throw new Error("Could not parse AI response: " + text.slice(0, 100));
      }

      const valid = ["search","assignee","status","priority","month","year"];
      const cleaned = {};
      for (const key of valid) {
        cleaned[key] = typeof filters[key] === "string" ? filters[key] : "";
      }

      setLastQ(query);
      setQuery("");
      onApplyFilters(cleaned);
    } catch (err) {
      setError("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleAsk();
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:16 }}>✦</span>
        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>Ask AI</span>
        <span style={{ fontSize:11, color:"var(--text3)", marginLeft:4 }}>Filter with natural language</span>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. show critical OTIs or who has not logged this week?"
          style={{ flex:1 }}
          disabled={loading}
        />
        <button
          className="btn"
          onClick={handleAsk}
          disabled={loading || !query.trim()}
          style={{ whiteSpace:"nowrap", minWidth:72, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Thinking..." : "Ask ✦"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize:12, color:"var(--red)", marginBottom:8 }}>{error}</div>
      )}

      {lastQ && !error && (
        <div style={{ fontSize:11, color:"var(--green)", marginBottom:8 }}>
          ✓ Filters applied for: "{lastQ}"
        </div>
      )}

      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => { setQuery(s); }}
            style={{
              fontSize:11, padding:"3px 10px", borderRadius:20,
              border:"1px solid var(--border2)", background:"transparent",
              color:"var(--text2)", cursor:"pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default AIQuery;
