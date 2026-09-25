import { useState, useEffect, useCallback, useRef } from "react";
import { Message, ToolCall, PageContext, Screenshot, PendingApproval, ServerMessage } from "../types";

const WS_URL = "ws://127.0.0.1:3848/ws";
const HTTP_URL = "http://127.0.0.1:3848";

interface UsePiAgentReturn {
  connected: boolean;
  sessionId: string | null;
  messages: Message[];
  pendingApproval: PendingApproval | null;
  pageContext: PageContext | null;
  screenshot: Screenshot | null;
  sendMessage: (text: string) => Promise<void>;
  approveTool: (callId: string) => Promise<void>;
  denyTool: (callId: string) => Promise<void>;
  requestPageContext: () => Promise<void>;
  requestScreenshot: () => Promise<void>;
  requestVision: (dataUrl: string, prompt: string) => Promise<string>;
  clearSession: () => void;
}

export function usePiAgent(): UsePiAgentReturn {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isMountedRef = useRef(true);

  // Generate or restore session ID
  useEffect(() => {
    const stored = localStorage.getItem("pi-agent-session-id");
    if (stored) setSessionId(stored);
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) {
      const newId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      setSessionId(newId);
      localStorage.setItem("pi-agent-session-id", newId);
    }

    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnected(true);
      console.log("[PiAgent] Connected");
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (error) {
        console.error("[PiAgent] Parse error:", error);
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnected(false);
      console.log("[PiAgent] Disconnected, reconnecting...");
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
      console.error("[PiAgent] WS error:", error);
    };
  }, [sessionId]);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    // Handle request responses
    if (msg.requestId && pendingRequestsRef.current.has(msg.requestId)) {
      const { resolve, reject } = pendingRequestsRef.current.get(msg.requestId)!;
      pendingRequestsRef.current.delete(msg.requestId);
      if (msg.type === "error") reject(new Error(String(msg.payload)));
      else resolve(msg.payload);
      return;
    }

    // Handle async messages
    switch (msg.type) {
      case "connected":
        setSessionId((msg.payload as any)?.sessionId ?? sessionId);
        break;

      case "assistant_token": {
        const { text, messageId } = msg.payload as { text: string; messageId: number };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.id === `msg_${messageId}`) {
            return [...prev.slice(0, -1), { ...last, content: last.content + text }];
          }
          return [...prev, { id: `msg_${messageId}`, role: "assistant", content: text, timestamp: Date.now() }];
        });
        break;
      }

      case "user_message": {
        const { messageId, text } = msg.payload as { messageId: number; text: string };
        setMessages((prev) => [...prev, { id: `msg_${messageId}`, role: "user", content: text, timestamp: Date.now() }]);
        break;
      }

      case "tool_call": {
        const call = msg.payload as ToolCall;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const toolCall: ToolCall = { ...call, status: "pending" };
          if (last && last.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, toolCalls: [...(last.toolCalls ?? []), toolCall] }];
          }
          return [...prev, { id: `tool_${call.id}`, role: "assistant", content: "", timestamp: Date.now(), toolCalls: [toolCall] }];
        });
        break;
      }

      case "tool_result": {
        const { callId, result, error } = msg.payload as { callId: string; result?: unknown; error?: string };
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) =>
              tc.id === callId ? { ...tc, status: error ? "failed" : "completed", result, error } : tc
            ),
          }))
        );
        break;
      }

      case "approval_request": {
        const approval = msg.payload as PendingApproval;
        setPendingApproval(approval);
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) =>
              tc.id === approval.callId ? { ...tc, status: "pending" } : tc
            ),
          }))
        );
        break;
      }

      case "history": {
        const { messages: history } = msg.payload as { messages: Message[] };
        setMessages(history);
        break;
      }

      case "page_context": {
        setPageContext(msg.payload as PageContext);
        break;
      }

      case "screenshot_result": {
        setScreenshot(msg.payload as Screenshot);
        break;
      }

      case "vision_result": {
        const { analysis } = msg.payload as { analysis: string };
        // Add as a system message or handle specially
        setMessages((prev) => [
          ...prev,
          { id: `vision_${Date.now()}`, role: "system", content: `🔍 Vision Analysis:\n${analysis}`, timestamp: Date.now() },
        ]);
        break;
      }

      case "error": {
        const errorMsg = String(msg.payload);
        console.error("[PiAgent] Server error:", errorMsg);
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: "system", content: `❌ Error: ${errorMsg}`, timestamp: Date.now() },
        ]);
        break;
      }
    }
  }, [sessionId]);

  const send = useCallback((msg: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }
      const requestId = `req_${++messageIdRef.current}`;
      const timeout = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId);
        reject(new Error("Request timeout"));
      }, 30000);

      pendingRequestsRef.current.set(requestId, { resolve, reject });
      wsRef.current!.send(JSON.stringify({ ...msg, requestId }));
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      await send({ type: "chat", payload: { message: text, context: pageContext ?? undefined } });
    },
    [send, pageContext]
  );

  const approveTool = useCallback(
    async (callId: string) => {
      await send({ type: "approval_response", payload: { callId, approved: true } });
      setPendingApproval(null);
    },
    [send]
  );

  const denyTool = useCallback(
    async (callId: string) => {
      await send({ type: "approval_response", payload: { callId, approved: false } });
      setPendingApproval(null);
    },
    [send]
  );

  const requestPageContext = useCallback(async () => {
    await send({ type: "get_page_context", payload: {} });
  }, [send]);

  const requestScreenshot = useCallback(async () => {
    await send({ type: "screenshot", payload: {} });
  }, [send]);

  const requestVision = useCallback(
    async (dataUrl: string, prompt: string) => {
      const result = await send({ type: "vision", payload: { dataUrl, prompt } });
      return result?.analysis ?? "No analysis returned";
    },
    [send]
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem("pi-agent-session-id");
    setSessionId(null);
    setMessages([]);
    setPageContext(null);
    setScreenshot(null);
    setPendingApproval(null);
    wsRef.current?.close();
    // Reconnect will create new session
  }, []);

  return {
    connected,
    sessionId,
    messages,
    pendingApproval,
    pageContext,
    screenshot,
    sendMessage,
    approveTool,
    denyTool,
    requestPageContext,
    requestScreenshot,
    requestVision,
    clearSession,
  };
}