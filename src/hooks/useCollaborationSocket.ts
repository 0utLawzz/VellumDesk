import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollaboratorPresence } from '../types/document';

const PRESENCE_PALETTE = [
  '#1D4ED8',
  '#0F766E',
  '#B45309',
  '#4338CA',
  '#BE123C',
  '#0369A1',
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_PALETTE[hash % PRESENCE_PALETTE.length];
}

interface RemotePatchPayload {
  type: 'section:patch';
  docId: string;
  clientId: string;
  authorName: string;
  sectionId?: string;
  heading?: string;
  body?: string;
  title?: string;
}

export function useCollaborationSocket(params: {
  docId: string | null;
  uid: string;
  displayName: string;
  onRemotePatch: (patch: RemotePatchPayload) => void;
}) {
  const { docId, uid, displayName, onRemotePatch } = params;
  const clientId = useMemo(
    () => `cli_${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const color = useMemo(() => pickColor(uid || clientId), [uid, clientId]);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const onPatchRef = useRef(onRemotePatch);
  onPatchRef.current = onRemotePatch;

  useEffect(() => {
    if (!docId) {
      setCollaborators([]);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'join',
            docId,
            clientId,
            uid,
            name: displayName,
            color,
            activeSectionId: null,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'presence:state' && msg.docId === docId) {
            setCollaborators(msg.members || []);
          } else if (msg.type === 'section:patch' && msg.docId === docId) {
            onPatchRef.current(msg as RemotePatchPayload);
          }
        } catch {
          // Ignore invalid socket frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          const delay = Math.min(8000, 1000 * Math.pow(1.6, attempt));
          attempt += 1;
          reconnectTimer = window.setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [docId, clientId, uid, displayName, color]);

  const emitFocus = (activeSectionId: string | null, isTyping = false) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:focus',
          activeSectionId,
          isTyping,
        })
      );
    }
  };

  const emitSectionPatch = (patch: {
    sectionId?: string;
    heading?: string;
    body?: string;
    title?: string;
  }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'section:patch',
          ...patch,
        })
      );
    }
  };

  const otherCollaborators = collaborators.filter((c) => c.clientId !== clientId);

  return {
    clientId,
    connected,
    collaborators,
    otherCollaborators,
    emitFocus,
    emitSectionPatch,
  };
}
