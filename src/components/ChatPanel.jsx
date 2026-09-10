import { useEffect, useRef, useState } from "react";

function renderRichText(text) {
  const pattern = /(\*\*[^*]+\*\*)|(!\[[^\]]*\]\([^)]+\))/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      nodes.push(<strong key={key++}>{match[1].slice(2, -2)}</strong>);
    } else if (match[2]) {
      const imgMatch = /!\[([^\]]*)\]\(([^)]+)\)/.exec(match[2]);
      if (imgMatch) {
        nodes.push(
          <img key={key++} src={imgMatch[2]} alt={imgMatch[1] || "generated"} className="chat-image" />
        );
      }
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MemoryChips({ events }) {
  if (!events?.length) return null;
  return (
    <div className="inline-memory-log">
      {events.map((e, i) => (
        <div key={i} className="memory-chip">
          {e.action === "update_information" && `✏️ ${e.args.field} → ${e.args.value}`}
          {e.action === "delete_information" && `🗑️ ${e.args.field} forgotten`}
          {e.action === "add_short_memory" && `➕ noted: ${e.args.note}`}
          {e.action === "delete_short_memory" && "🗑️ note forgotten"}
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="message-skeleton" aria-label="ZEHRIN is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function ChatPanel({
  messages,
  onSend,
  onRegenerate,
  onMicResult,
  listening,
  setListening,
  onStopSpeaking,
  onDeleteMessage,
  onShowNotice,
  avatarSrc,
  showWelcome
}) {
  const [value, setValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e) => onMicResult(e.results[0][0].transcript);
    recognitionRef.current = recognition;
  }, [onMicResult, setListening]);

  function handleSend() {
    const text = value.trim();
    if (!text) return;
    onSend(text, editingMessageId ? { replaceMessageId: editingMessageId } : {});
    setValue("");
    setEditingMessageId(null);
  }

  function handleEdit(message) {
    setEditingMessageId(message.id);
    setValue(message.text);
  }

  async function handleCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
      onShowNotice("Message copied.");
    } catch {
      onShowNotice("Copy nahi ho paya, Boss.");
    }
  }

  function handleMic() {
    if (!recognitionRef.current) {
      onShowNotice("Boss, aapke browser mein speech recognition available nahi hai.");
      return;
    }
    onStopSpeaking();
    try {
      recognitionRef.current.start();
    } catch {
      // ignore double-start
    }
  }

  return (
    <div className="chat-main">
      <div className="chat-messages" ref={listRef}>
        {showWelcome && (
          <div className="chat-welcome" aria-live="polite">
            <strong>ZEHRIN</strong>
            <span>Ready when you are, Boss.</span>
            <small>Swipe right to open the menu and create a new chat</small>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.role}`}>
            {m.role === "assistant" && (
              <img
                src={avatarSrc}
                alt="ZEHRIN"
                className="avatar"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            )}
            <div className={`bubble ${m.role}`}>
              <span className="bubble-label">{m.role === "user" ? "Boss" : "ZEHRIN"}</span>
              {!m.text && m.role === "assistant" ? (
                <MessageSkeleton />
              ) : (
                <>
                  <p>{renderRichText(m.text || "")}</p>
                  <div className="message-actions">
                    <button onClick={() => handleCopy(m.text || "")}>Copy</button>
                    {m.role === "user" && <button onClick={() => handleEdit(m)}>Edit</button>}
                    {m.role === "assistant" && (
                      <button
                        onClick={() => {
                          const index = messages.findIndex((message) => message.id === m.id);
                          const previous = index > 0 ? messages[index - 1] : null;
                          if (previous?.role === "user") onRegenerate(previous);
                        }}
                      >
                        Regenerate
                      </button>
                    )}
                    <button className="message-delete-btn" title="Delete message" onClick={() => onDeleteMessage(m.id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
              <MemoryChips events={m.memoryEvents} />
            </div>
          </div>
        ))}
      </div>
      {editingMessageId && (
        <div className="editing-banner">
          Editing message
          <button onClick={() => { setEditingMessageId(null); setValue(""); }}>Cancel</button>
        </div>
      )}
      <div className="chat-controls">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Boss, kuch poochho..."
          autoComplete="off"
        />
        <button onClick={handleSend}>Send</button>
        <button className={listening ? "mic-active" : ""} onClick={handleMic}>
          🎙
        </button>
      </div>
    </div>
  );
}