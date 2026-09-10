import { useState } from "react";

export default function Sidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSwitchSession,
  onRenameSession,
  onDeleteSession,
  collapsed,
  setCollapsed,
  onOpenSettings
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(session) {
    setEditingId(session.id);
    setEditValue(session.title);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) onRenameSession(editingId, editValue.trim());
    setEditingId(null);
  }

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <div className="sidebar-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sidebar-item ${s.id === currentSessionId ? "active" : ""}`}
            onClick={() => onSwitchSession(s.id)}
          >
            {editingId === s.id ? (
              <input
                autoFocus
                className="rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="sidebar-item-title">{s.title || "New Chat"}</span>
                <button
                  className="rename-btn"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(s);
                  }}
                >
                  ✎
                </button>
                <button
                  className="delete-btn"
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                >
                  🗑
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="settings-btn" onClick={onOpenSettings}>
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}