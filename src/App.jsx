import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel from "./components/ChatPanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import SettingsPanel, { BACKGROUND_OPTIONS } from "./components/SettingsPanel.jsx";
import { speak, stopSpeaking } from "./lib/speech.js";

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
}

const SESSION_STORAGE_KEY = "zehrin_session_id";
const THEME_KEY = "zehrin_theme";
const BG_KEY = "zehrin_bg";
const AVATAR_SRC = "/zehrin-dp.png"; // replace this file in public/ to change ZEHRIN's DP

function getChatRouteId() {
  const match = window.location.pathname.match(/^\/chat\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const speakingLevelRef = useRef(0);
  const touchStartXRef = useRef(null);
  const temporarySessionRef = useRef(null);
  const startupPromiseRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 680);

  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("Online");
  const [listening, setListening] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [background, setBackgroundState] = useState(() => localStorage.getItem(BG_KEY) || "none");

  function handleTouchStart(event) {
    if (window.innerWidth <= 680) {
      touchStartXRef.current = event.touches[0]?.clientX ?? null;
    }
  }

  function handleTouchEnd(event) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null || window.innerWidth > 680) return;

    const endX = event.changedTouches[0]?.clientX;
    if (typeof endX !== "number") return;
    const distance = endX - startX;

    if (distance > 60 && startX < 48) {
      setSidebarCollapsed(false);
    } else if (distance < -60 && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(BG_KEY, background);
  }, [background]);

  const bgOption = BACKGROUND_OPTIONS.find((b) => b.id === background);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
      return data.sessions || [];
    } catch (err) {
      console.error("Failed to load sessions", err);
      return [];
    }
  }, []);

  const loadSessionMessages = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      const data = await res.json();
      const loaded = (data.messages || []).map((m) => ({
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        text: m.text,
        memoryEvents: []
      }));
      setMessages(loaded);
    } catch (err) {
      console.error("Failed to load messages", err);
      setMessages([]);
    }
  }, []);

  const switchSession = useCallback(
    (sessionId) => {
      setCurrentSessionId(sessionId);
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      window.history.pushState({}, "", `/chat/${encodeURIComponent(sessionId)}`);
      stopSpeaking();
      loadSessionMessages(sessionId);
    },
    [loadSessionMessages]
  );

  const newChat = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      setSessions((prev) => [data.session, ...prev]);
      switchSession(data.session.id);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  }, [switchSession]);

  const renameSessionHandler = useCallback(async (id, title) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
    } catch (err) {
      console.error("Failed to rename session", err);
    }
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete message");
    } catch (err) {
      console.error(err);
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId, loadSessionMessages]);

  const deleteMessageHandler = useCallback((messageId) => {
    if (!currentSessionId) return;
    setDialog({
      message: "Delete this message?",
      confirmLabel: "Delete",
      onConfirm: () => {
        setDialog(null);
        deleteMessage(messageId);
      }
    });
  }, [currentSessionId, deleteMessage]);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat");
      const remaining = sessions.filter((session) => session.id !== sessionId);
      setSessions(remaining);
      if (sessionId === currentSessionId) {
        stopSpeaking();
        if (remaining.length) {
          switchSession(remaining[0].id);
        } else {
          newChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  }, [currentSessionId, newChat, sessions, switchSession]);

  const deleteSessionHandler = useCallback((sessionId) => {
    setDialog({
      message: "Delete this entire chat?",
      confirmLabel: "Delete",
      onConfirm: () => {
        setDialog(null);
        deleteSession(sessionId);
      }
    });
  }, [deleteSession]);

  // Start every reload with an in-memory-only chat. It is backed by a
  // temporary server session while the tab is open, then removed on unload.
  useEffect(() => {
    if (startupPromiseRef.current) return undefined;

    startupPromiseRef.current = (async () => {
      try {
        const existing = await refreshSessions();
        const routedSessionId = getChatRouteId();
        const routedSession = existing.find((session) => session.id === routedSessionId);

        if (routedSession) {
          setSessions(existing);
          setCurrentSessionId(routedSession.id);
          localStorage.setItem(SESSION_STORAGE_KEY, routedSession.id);
          await loadSessionMessages(routedSession.id);
          return;
        }

        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temporary: true })
        });
        const data = await res.json();
        temporarySessionRef.current = data.session.id;
        setCurrentSessionId(data.session.id);
        window.history.replaceState({}, "", "/");
        setSessions(existing);
        setMessages([]);
      } catch (err) {
        console.error("Failed to create temporary chat", err);
      }
    })();

    const cleanupTemporaryChat = () => {
      const id = temporarySessionRef.current;
      if (id) navigator.sendBeacon(`/api/sessions/${id}/cleanup`);
    };
    window.addEventListener("beforeunload", cleanupTemporaryChat);
    return undefined;
  }, [loadSessionMessages, refreshSessions]);

  const sendMessage = useCallback(
    async (text, options = {}) => {
      const trimmed = text.trim();
      if (!trimmed || !currentSessionId) return;

      const messageText = trimmed;
      const userId = options.replaceMessageId || uid();
      const assistantId = uid();
      setMessages((prev) => {
        const replaceIndex = options.replaceMessageId
          ? prev.findIndex((message) => message.id === options.replaceMessageId)
          : -1;
        const next = replaceIndex >= 0
          ? [
              ...prev.slice(0, replaceIndex),
              {
                ...prev[replaceIndex],
                id: userId,
                text: messageText,
              }
            ]
          : [
              ...prev,
              {
                id: userId,
                role: "user",
                text: messageText,
                memoryEvents: []
              }
            ];
        return [...next, { id: assistantId, role: "assistant", text: "", memoryEvents: [] }];
      });
      setStatus("Thinking...");

      let fullText = "";

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            sessionId: currentSessionId,
            clientMessageId: userId,
            replaceMessageId: options.replaceMessageId
          })
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop();

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            let evt;
            try {
              evt = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (evt.type === "chunk") {
              fullText += evt.text;
              const snapshot = fullText;
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: snapshot } : m)));
            } else if (evt.type === "memory") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, memoryEvents: [...m.memoryEvents, evt] } : m
                )
              );
            } else if (evt.type === "image") {
             const imageMarkdown = `\n\n![generated image](${evt.url})`;
             fullText += imageMarkdown;
             setMessages((prev) =>
               prev.map((m) => (m.id === assistantId ? { ...m, text: fullText } : m))
             );
            } else if (evt.type === "error") {
              fullText = evt.message || "Kuch gadbad ho gayi Boss.";
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: fullText } : m)));
            }
          }
        }

        setStatus("Online");
        if (fullText.trim()) {
          speak(fullText, speakingLevelRef);
        }
        refreshSessions();
      } catch (err) {
        console.error(err);
        setStatus("Online");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: "Sorry Boss, connection mein problem aa gayi." }
              : m
          )
        );
      }
    },
    [currentSessionId, refreshSessions]
  );

  const handleMicResult = useCallback((text) => sendMessage(text), [sendMessage]);

  return (
    <div
      className="app-shell"
      style={bgOption?.path ? { backgroundImage: `url(${bgOption.path})` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={newChat}
        onSwitchSession={switchSession}
        onRenameSession={renameSessionHandler}
        onDeleteSession={deleteSessionHandler}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="main-column">
        <div className="top-bar">
          <img
            src={AVATAR_SRC}
            alt="ZEHRIN"
            className="top-bar-avatar"
            onClick={() => setAvatarViewerOpen(true)}
            onError={(e) => (e.target.style.visibility = "hidden")}
          />
          <div>
            <div className="top-bar-name">ZEHRIN</div>
            <div className="top-bar-status">{status}</div>
          </div>
        </div>

        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          onRegenerate={(message) => sendMessage(message.text, { replaceMessageId: message.id })}
          onMicResult={handleMicResult}
          listening={listening}
          setListening={setListening}
          onStopSpeaking={() => {
            stopSpeaking();
          }}
          onDeleteMessage={deleteMessageHandler}
          onShowNotice={(message) => setDialog({ message, confirmLabel: "OK" })}
          avatarSrc={AVATAR_SRC}
          showWelcome={messages.length === 0}
        />
      </div>

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          setTheme={setThemeState}
          background={background}
          setBackground={setBackgroundState}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {dialog && (
        <div className="app-dialog-overlay" onClick={() => setDialog(null)}>
          <div className="app-dialog" onClick={(event) => event.stopPropagation()}>
            <p>{dialog.message}</p>
            <div className="app-dialog-actions">
              {dialog.onConfirm && (
                <button className="dialog-danger" onClick={dialog.onConfirm}>
                  {dialog.confirmLabel || "Confirm"}
                </button>
              )}
              <button onClick={() => setDialog(null)}>{dialog.onConfirm ? "Cancel" : "OK"}</button>
            </div>
          </div>
        </div>
      )}
      {avatarViewerOpen && (
        <div className="avatar-viewer-overlay" onClick={() => setAvatarViewerOpen(false)}>
          <img
            src={AVATAR_SRC}
            alt="ZEHRIN profile"
            className="avatar-viewer-image"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}