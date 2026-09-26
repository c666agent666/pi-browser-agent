/**
 * usePiAgent — owns the WebSocket connection to the server.
 *
 * Deliberately NOT routed through the MV3 service worker: Chrome
 * terminates idle workers after ~30s, which would keep killing the
 * socket. The side panel's lifetime matches the connection lifetime.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ClientMessage,
  ConversationMeta,
  Message,
  ModelRef,
  ModelsListState,
  PageContextSummary,
  ServerMessage,
  ServerSettingsState,
  TestModelResult,
  ToolCall,
} from "../types";

const WS_URL = "ws://127.0.0.1:3848/ws";
const STORAGE_KEY = "pi-agent-session-id";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface PiAgentApi {
  connected: boolean;
  sessionId: string | null;
  streaming: boolean;
  messages: Message[];
  serverSettings: ServerSettingsState | null;
  modelsList: ModelsListState | null;
  conversations: ConversationMeta[] | null;
  sendMessage: (text: string, context?: PageContextSummary) => Promise<void>;
  abort: () => Promise<void>;
  newSession: () => void;
  requestScreenshot: (url?: string) => Promise<void>;
  requestVision: (image: string, prompt: string, model?: string) => Promise<string>;
  refreshServerSettings: () => Promise<void>;
  refreshModels: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  setInteractionModel: (provider: string, modelId: string) => Promise<void>;
  setVisionModel: (model: string) => Promise<void>;
  testModel: (model: string) => Promise<TestModelResult>;
  switchToConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearMessages: () => void;
}

export function usePiAgent(): PiAgentApi {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverSettings, setServerSettings] = useState<ServerSettingsState | null>(null);
  const [modelsList, setModelsList] = useState<ModelsListState | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[] | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const nextRequestIdRef = useRef(0);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attemptRef = useRef(0);
  const aliveRef = useRef(true);
  // Latest assistant message id for token routing; kept across renders.
  const activeAssistantIdRef = useRef<string | null>(null);

  const send = useCallback((frame: ClientMessage): Promise<unknown> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Not connected"));
    const requestId = "requestId" in frame ? frame.requestId : `req_anon_${Date.now()}`;
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    const timeout = setTimeout(() => {
      pendingRef.current.delete(requestId);
      reject(new Error("Request timed out"));
    }, 120_000);
    pendingRef.current.set(requestId, { resolve, reject, timeout });
    ws.send(JSON.stringify(frame));
    return promise;
  }, []);

  const connect = useCallback(() => {
    if (!aliveRef.current) return;
    const stored = sessionIdRef.current ?? localStorage.getItem(STORAGE_KEY);
    const url = stored ? `${WS_URL}?sessionId=${encodeURIComponent(stored)}` : WS_URL;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      // Ping loop keeps intermediate proxies honest.
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        else clearInterval(ping);
      }, 30_000);
      ws.addEventListener("close", () => clearInterval(ping), { once: true });
    };

    ws.onmessage = event => {
      let frame: ServerMessage;
      try {
        frame = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      handleFrame(frame);
    };

    ws.onclose = () => {
      setConnected(false);
      pendingRef.current.forEach(p => { clearTimeout(p.timeout); p.reject(new Error("Connection closed")); });
      pendingRef.current.clear();
      if (!aliveRef.current) return;
      const delay = Math.min(1000 * 2 ** attemptRef.current++, 15_000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose follows; reconnect logic lives there.
    };
  }, []);

  const handleFrame = useCallback((frame: ServerMessage) => {
    switch (frame.type) {
      case "connected": {
        sessionIdRef.current = frame.payload.sessionId;
        localStorage.setItem(STORAGE_KEY, frame.payload.sessionId);
        setSessionId(frame.payload.sessionId);
        setConnected(true);
        if (!frame.payload.resumed) {
          // Fresh conversation — no session file to replay.
          setMessages([]);
        }
        // Pull live model state from the server.
        void send({ type: "get_server_settings", requestId: `req_${nextRequestIdRef.current++}` });
        void send({ type: "get_models", requestId: `req_${nextRequestIdRef.current++}` });
        void send({ type: "list_conversations", requestId: `req_${nextRequestIdRef.current++}` });
        break;
      }

      case "conversations": {
        setConversations(frame.payload.conversations);
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload.conversations);
        }
        break;
      }

      case "server_settings": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        setServerSettings(frame.payload);
        break;
      }

      case "models": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        setModelsList(frame.payload);
        break;
      }

      case "test_model_result": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        break;
      }

      case "history": {
        // Replayed conversation after resume — replace local state.
        setMessages(
          frame.payload.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.text,
            timestamp: 0,
          })),
        );
        break;
      }

      case "assistant_token": {
        const { messageId, text } = frame.payload;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          // Update the current assistant block in place — never one line per token.
          if (last && last.role === "assistant" && last.id === activeAssistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, content: text }];
          }
          activeAssistantIdRef.current = messageId;
          return [...prev, { id: messageId, role: "assistant", content: text, timestamp: Date.now() }];
        });
        setStreaming(true);
        break;
      }

      case "thinking_token": {
        const { messageId, delta } = frame.payload;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.id === activeAssistantIdRef.current) {
            return [...prev.slice(0, -1), { ...last, thinking: (last.thinking ?? "") + delta }];
          }
          activeAssistantIdRef.current = messageId;
          return [...prev, { id: messageId, role: "assistant", content: "", thinking: delta, timestamp: Date.now() }];
        });
        break;
      }

      case "tool_call": {
        const call = frame.payload;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const updated: ToolCall = {
            id: call.id,
            name: call.name,
            args: call.args,
            status: call.status,
          };
          if (last?.role === "assistant") {
            const existing = last.toolCalls?.find(tc => tc.id === call.id);
            const toolCalls = existing
              ? last.toolCalls!.map(tc => (tc.id === call.id ? { ...tc, status: call.status } : tc))
              : [...(last.toolCalls ?? []), updated];
            return [...prev.slice(0, -1), { ...last, toolCalls }];
          }
          return [...prev, { id: `tools_${Date.now()}`, role: "assistant", content: "", toolCalls: [updated], timestamp: Date.now() }];
        });
        break;
      }

      case "tool_result": {
        const { id, result, isError } = frame.payload;
        setMessages(prev =>
          prev.map(m => ({
            ...m,
            toolCalls: m.toolCalls?.map(tc =>
              tc.id === id ? { ...tc, status: isError ? ("failed" as const) : ("completed" as const), result, error: isError ? String(result).slice(0, 500) : undefined } : tc,
            ),
          })),
        );
        break;
      }

      case "turn_end": {
        setStreaming(false);
        break;
      }

      case "response": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        break;
      }

      case "error": {
        const errorRequestId = frame.requestId;
        const pending = errorRequestId ? pendingRef.current.get(errorRequestId) : undefined;
        if (pending && errorRequestId) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(errorRequestId);
          pending.reject(new Error(frame.payload.message));
        } else {
          setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: "system", content: `⚠️ ${frame.payload.message}`, timestamp: Date.now() }]);
        }
        break;
      }

      case "screenshot_result": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        window.dispatchEvent(new CustomEvent("pi-agent-screenshot", { detail: frame.payload }));
        break;
      }

      case "vision_result": {
        const pending = pendingRef.current.get(frame.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRef.current.delete(frame.requestId);
          pending.resolve(frame.payload);
        }
        break;
      }

      case "pong":
        break;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback(async (text: string, context?: PageContextSummary) => {
    if (!text.trim()) return;
    const requestId = `req_${nextRequestIdRef.current++}`;
    // Optimistic user message; server streams the assistant reply.
    setMessages(prev => [...prev, { id: `user_${requestId}`, role: "user", content: text, timestamp: Date.now() }]);
    activeAssistantIdRef.current = null;
    setStreaming(true);
    try {
      await send({ type: "chat", requestId, payload: { message: text, context } });
    } catch (error) {
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: "system", content: `⚠️ ${String(error)}`, timestamp: Date.now() }]);
      setStreaming(false);
    }
  }, [send]);

  const abort = useCallback(async () => {
    const requestId = `req_${nextRequestIdRef.current++}`;
    await send({ type: "abort", requestId });
    setStreaming(false);
  }, [send]);

  const switchToConversation = useCallback((conversationId: string) => {
    // Switch = remember the id, reconnect; the server respawns the
    // subprocess and replays history via switch_session. If the id is
    // fresh (new chat), the old conversation stays in the registry.
    sessionIdRef.current = conversationId;
    localStorage.setItem(STORAGE_KEY, conversationId);
    setMessages([]);
    activeAssistantIdRef.current = null;
    wsRef.current?.close(); // onclose schedules the reconnect with the new id
  }, []);

  const newSession = useCallback(() => {
    const freshId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    switchToConversation(freshId);
  }, [switchToConversation]);

  const refreshConversations = useCallback(async () => {
    await send({ type: "list_conversations", requestId: `req_${nextRequestIdRef.current++}` });
  }, [send]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await send({ type: "delete_conversation", requestId: `req_${nextRequestIdRef.current++}`, payload: { conversationId } });
    await send({ type: "list_conversations", requestId: `req_${nextRequestIdRef.current++}` });
    // Deleting the active conversation forces a fresh one.
    if (conversationId === sessionIdRef.current) newSession();
  }, [send, newSession]);

  const requestScreenshot = useCallback(async (url?: string) => {
    const requestId = `req_${nextRequestIdRef.current++}`;
    await send({ type: "screenshot", requestId, payload: { url } });
  }, [send]);

  const requestVision = useCallback(async (image: string, prompt: string, model?: string) => {
    const requestId = `req_${nextRequestIdRef.current++}`;
    const result = (await send({ type: "vision", requestId, payload: { image, prompt, model } })) as { analysis: string };
    return result.analysis;
  }, [send]);

  const refreshServerSettings = useCallback(async () => {
    await send({ type: "get_server_settings", requestId: `req_${nextRequestIdRef.current++}` });
  }, [send]);

  const refreshModels = useCallback(async () => {
    await send({ type: "get_models", requestId: `req_${nextRequestIdRef.current++}` });
  }, [send]);

  const setInteractionModel = useCallback(
    async (provider: string, modelId: string) => {
      await send({
        type: "set_interaction_model",
        requestId: `req_${nextRequestIdRef.current++}`,
        payload: { provider, modelId },
      });
    },
    [send],
  );

  const setVisionModel = useCallback(async (model: string) => {
    await send({
      type: "set_vision_model",
      requestId: `req_${nextRequestIdRef.current++}`,
      payload: { model },
    });
  }, [send]);

  const testModel = useCallback(async (model: string): Promise<TestModelResult> => {
    const result = (await send({
      type: "test_model",
      requestId: `req_${nextRequestIdRef.current++}`,
      payload: { model },
    })) as TestModelResult;
    return result;
  }, [send]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    activeAssistantIdRef.current = null;
  }, []);

  return {
    connected,
    sessionId,
    streaming,
    messages,
    serverSettings,
    modelsList,
    conversations,
    sendMessage,
    abort,
    newSession,
    requestScreenshot,
    requestVision,
    refreshServerSettings,
    refreshModels,
    refreshConversations,
    setInteractionModel,
    setVisionModel,
    testModel,
    switchToConversation,
    deleteConversation,
    clearMessages,
  };
}