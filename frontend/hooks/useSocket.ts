"use client";
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    // Reuse existing connection if token unchanged
    if (socketRef.current?.connected) return;

    const s = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = s;
    socket = s;

    // Heartbeat: keep presence alive every 30s
    const hb = setInterval(() => s.emit("presence:update"), 30_000);

    return () => {
      clearInterval(hb);
      s.disconnect();
      socketRef.current = null;
      socket = null;
    };
  }, [token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { emit, on, socket: socketRef.current };
}

/** Access the socket singleton from non-hook contexts */
export function getSocket() { return socket; }
