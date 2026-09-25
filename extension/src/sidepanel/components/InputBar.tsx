import React, { useState, useRef, useEffect, KeyboardEvent } from "react";

interface InputBarProps {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState("");
  const [height, setHeight] = useState(44);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      setHeight(newHeight);
    }
  }, [text]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    const message = text.trim();
    setText("");
    setHeight(44);
    await onSend(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={{ ...styles.inputWrapper, height }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connecting..." : "Ask Pi to analyze this page, write code, or automate tasks..."}
          disabled={disabled}
          style={styles.textarea}
          spellCheck={false}
          autoFocus
        />
      </div>
      <div style={styles.hints}>
        <kbd style={styles.kbd}>Enter</kbd> Send &nbsp;
        <kbd style={styles.kbd}>Shift+Enter</kbd> New line
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { padding: "12px", borderTop: "1px solid #30363d", background: "#161b22" },
  inputWrapper: { position: "relative", maxWidth: "100%" },
  textarea: {
    width: "100%",
    height: "100%",
    minHeight: "44px",
    maxHeight: "200px",
    padding: "10px 12px",
    border: "1px solid #30363d",
    borderRadius: "8px",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: "13px",
    lineHeight: 1.5,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
  },
  hints: { marginTop: "8px", fontSize: "11px", color: "#6e7681", textAlign: "right" },
  kbd: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "4px",
    padding: "1px 6px",
    fontFamily: "monospace",
    fontSize: "10px",
  },
};