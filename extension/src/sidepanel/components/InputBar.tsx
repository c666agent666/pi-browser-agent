import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { colors, font } from "../theme";

export function InputBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  const submit = async () => {
    const message = text.trim();
    if (!message || disabled) return;
    setHistory(prev => [message, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    setText("");
    await onSend(message);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    } else if (event.key === "ArrowUp" && !event.shiftKey && text === "") {
      // Console-style history recall.
      if (history.length > 0) {
        const next = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(next);
        setText(history[next]);
        event.preventDefault();
      }
    } else if (event.key === "ArrowDown" && !event.shiftKey && historyIndex >= 0) {
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setText(next >= 0 ? history[next] : "");
      event.preventDefault();
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <span style={styles.promptMarker}>λ</span>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "connecting to server…"
              : "open example.com and summarize the page — the agent will drive this browser"
          }
          disabled={disabled}
          spellCheck={false}
          autoFocus
          style={styles.textarea}
          rows={1}
        />
        {text === "" && !disabled && <span className="pi-cursor" style={styles.cursor}>▊</span>}
      </div>
      <div style={styles.hints}>
        <span>enter send · shift+enter newline · ↑ history</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    borderTop: `1px solid ${colors.borderBright}`,
    background: colors.bgPanel,
    padding: "8px 10px 4px",
  },
  row: { display: "flex", alignItems: "flex-start", gap: 8, position: "relative" },
  promptMarker: {
    color: colors.green,
    fontWeight: 700,
    paddingTop: 4,
    textShadow: `0 0 6px ${colors.greenFaint}`,
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: colors.white,
    fontFamily: font.mono,
    fontSize: font.size,
    lineHeight: 1.5,
    resize: "none",
    padding: "3px 0",
    caretColor: colors.green,
  },
  cursor: { position: "absolute", left: 18, top: 5, fontSize: font.size },
  hints: { color: colors.faint, fontSize: font.sizeTiny, textAlign: "right", marginTop: 2 },
};