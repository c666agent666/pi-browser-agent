import React, { useState } from "react";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";
import type { ConversationMeta } from "../types";
import { CloseButton } from "./CloseButton";

/**
 * Conversation history — every past chat with its title (first message)
 * and activity time. Click a row to continue that task; the delete
 * control needs two deliberate clicks (del → red confirm, 3s window),
 * so it can never happen by accident.
 */
export function HistoryPanel({
  conversations,
  activeSessionId,
  onClose,
  onSwitch,
  onDelete,
}: {
  conversations: ConversationMeta[] | null;
  activeSessionId: string | null;
  onClose: () => void;
  onSwitch: (conversationId: string) => void;
  onDelete: (conversationId: string) => Promise<void>;
}) {
  const t = useTheme();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const requestDelete = (id: string) => {
    if (confirmingId !== id) {
      // First click: arm the confirm, 3s window.
      setConfirmingId(id);
      setTimeout(() => setConfirmingId(current => (current === id ? null : current)), 3000);
      return;
    }
    setConfirmingId(null);
    setDeleting(id);
    void onDelete(id).finally(() => setDeleting(null));
  };

  return (
    <div style={{ ...styles.panel, background: t.bgPanel, borderBottom: `1px solid ${t.borderBright}` }}>
      <div style={styles.header}>
        <span style={{ color: t.green, fontSize: font.sizeSmall }}>┌ history</span>
        <span style={{ color: t.faint, fontSize: font.sizeTiny, flex: 1, marginLeft: 8 }}>
          every conversation is kept — new chat never erases them
        </span>
        <CloseButton onClick={onClose} title="Close history" />
      </div>
      <div style={styles.body}>
        {!conversations && <div style={{ color: t.faint, fontSize: font.sizeSmall }}>loading…</div>}
        {conversations && conversations.length === 0 && (
          <div style={{ color: t.faint, fontSize: font.sizeSmall }}>
            no conversations yet — history is created as you chat
          </div>
        )}
        {conversations?.map(conv => {
          const active = conv.id === activeSessionId;
          return (
            <div key={conv.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                className="pi-btn"
                onClick={() => {
                  if (!active) onSwitch(conv.id);
                  else onClose();
                }}
                title={active ? "This is the current conversation" : "Continue this conversation"}
                style={{
                  ...styles.row,
                  background: active ? t.zebra : "transparent",
                  borderLeft: `2px solid ${active ? t.green : t.border}`,
                  opacity: deleting === conv.id ? 0.4 : 1,
                }}
              >
                <span style={{ color: active ? t.green : t.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {active ? "λ " : ""}{conv.title}
                </span>
                <span style={{ color: t.faint, fontSize: font.sizeTiny, flexShrink: 0 }}>
                  {relativeTime(conv.lastActiveAt)}
                </span>
              </button>
              <button
                className="pi-btn"
                onClick={() => requestDelete(conv.id)}
                disabled={deleting === conv.id}
                title={
                  confirmingId === conv.id
                    ? "Click again to permanently delete this conversation (registry entry + session file)"
                    : "Delete this conversation — requires a second confirming click"
                }
                style={{
                  ...styles.del,
                  color: confirmingId === conv.id ? t.red : t.faint,
                  borderColor: confirmingId === conv.id ? t.red : t.border,
                  fontSize: font.sizeTiny,
                }}
              >
                {deleting === conv.id ? "…" : confirmingId === conv.id ? "confirm?" : "del"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  panel: { maxHeight: "50vh", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: 8, padding: "5px 10px" },
  body: { padding: "0 10px 10px", overflow: "auto", display: "flex", flexDirection: "column", gap: 4 },
  row: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 8px",
    fontFamily: font.mono,
    fontSize: font.sizeSmall,
    textAlign: "left",
    minWidth: 0,
    cursor: "pointer",
  },
  del: {
    background: "transparent",
    border: "1px solid",
    padding: "2px 6px",
    fontFamily: font.mono,
    flexShrink: 0,
    cursor: "pointer",
  },
};