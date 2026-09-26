import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

export function InputBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}) {
  const t = useTheme();
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
    <div style={{ borderTop: `1px solid ${t.borderBright}`, background: t.bgPanel, padding: "8px 10px 4px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, position: "relative" }}>
        <span
          style={{ color: t.green, fontWeight: 700, paddingTop: 4, textShadow: `0 0 6px ${t.greenFaint}` }}
          title="Your input — everything you type here goes to the agent"
        >
          λ
        </span>
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
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: t.white,
            fontFamily: font.mono,
            fontSize: font.size,
            lineHeight: 1.5,
            resize: "none",
            padding: "3px 0",
            caretColor: t.green,
          }}
        />
        {text === "" && !disabled && (
          <span className="pi-cursor" style={{ position: "absolute", left: 18, top: 5, fontSize: font.size }}>
            ▊
          </span>
        )}
      </div>
      <div style={{ color: t.faint, fontSize: font.sizeTiny, textAlign: "right", marginTop: 2 }}>
        enter send · shift+enter newline · ↑ history
      </div>
    </div>
  );
}