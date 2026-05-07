"use client";

import { useEffect } from "react";

import { websocketUrlFor } from "@/lib/api";
import type { DebateMessage } from "@/lib/types";

import { useDebateStore } from "./useDebateStore";

export function useDebateSocket(debateId: string | null): void {
  const handleMessage = useDebateStore((state) => state.handleMessage);
  const setConnected = useDebateStore((state) => state.setConnected);
  const setError = useDebateStore((state) => state.setError);

  useEffect(() => {
    if (!debateId) {
      return undefined;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    const connect = () => {
      socket = new WebSocket(websocketUrlFor(debateId));

      socket.onopen = () => {
        setConnected(true);
        setError(null);
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as DebateMessage;
          handleMessage(parsed);
        } catch {
          setError("Received an unreadable WebSocket message.");
        }
      };

      socket.onerror = () => {
        setError("Live connection error. Reconnecting...");
      };

      socket.onclose = () => {
        setConnected(false);
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
      setConnected(false);
    };
  }, [debateId, handleMessage, setConnected, setError]);
}
