const LABELS = {
  update_information: "✏️ Updated",
  delete_information: "🗑️ Removed",
  add_short_memory: "➕ Noted",
  delete_short_memory: "🗑️ Forgot"
};

export default function MemoryLog({ events }) {
  if (!events.length) return null;

  return (
    <div className="memory-log">
      {events.map((e) => (
        <div key={e.id} className="memory-log-item">
          <strong>{LABELS[e.action] || e.action}</strong>
          {e.args?.field && `: ${e.args.field}`}
          {e.args?.value && ` → ${e.args.value}`}
          {e.args?.note && ` → ${e.args.note}`}
          {e.args?.id && ` [${e.args.id}]`}
        </div>
      ))}
    </div>
  );
}
