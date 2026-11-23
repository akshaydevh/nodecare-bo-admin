import { useEffect, useRef, useState } from 'react';
import { apiOpenStream } from './api';

/**
 * Live hints from the backend (GET /realtime/stream, server-sent events).
 *
 * A hint only says that something changed, for example "ops.updated". The
 * panel answers by refetching through the normal API. Hints can be missed
 * (a dropped connection, a deploy), so screens keep polling, just far less
 * often while the stream is connected.
 *
 * The stream is read with fetch, not EventSource, because EventSource cannot
 * send the Authorization header and the token must not go in the URL.
 */
export type RealtimeHint = 'ops.updated' | 'booking.updated' | 'notification.created' | 'resync';

const STREAM_PATH = '/realtime/stream';
/** The server sends a keep-alive every 25 s; this long without one means the connection is dead. */
const SILENCE_LIMIT_MS = 70_000;
const MAX_RETRY_MS = 60_000;
/** After the server says this account has too many streams open, leave it alone for a while. */
const STAY_AWAY_MS = 5 * 60_000;
/** A hidden tab keeps its stream this long, so quick tab switches do not reconnect. */
const HIDDEN_GRACE_MS = 30_000;

type Handlers = {
  onHint: (hint: RealtimeHint) => void;
  onStatus: (connected: boolean) => void;
};

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

/** Keeps one stream open until the returned function is called. */
function connect({ onHint, onStatus }: Handlers): () => void {
  const stop = new AbortController();
  let retryMs = 5_000;

  async function readOnce(): Promise<'ended' | 'failed' | 'signed-out' | 'stay-away'> {
    const attempt = new AbortController();
    const abort = () => attempt.abort();
    stop.signal.addEventListener('abort', abort, { once: true });
    let silence: ReturnType<typeof setTimeout> | undefined;
    const heard = () => {
      clearTimeout(silence);
      silence = setTimeout(abort, SILENCE_LIMIT_MS);
    };
    let ready = false;
    let stayAway = false;

    try {
      heard();
      const res = await apiOpenStream(STREAM_PATH, attempt.signal);
      if (res.status === 401) return 'signed-out';
      if (!res.ok || !res.body) return 'failed';

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        heard();
        buffer += decoder.decode(value, { stream: true });
        let cut = buffer.indexOf('\n\n');
        while (cut >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          cut = buffer.indexOf('\n\n');

          let event = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('retry:')) retryMs = Number(line.slice(6).trim()) || retryMs;
          }
          if (event === 'ready') {
            ready = true;
            onStatus(true);
          } else if (event === 'bye') {
            stayAway = true;
          } else if (event) {
            onHint(event as RealtimeHint);
          }
        }
      }
      if (stayAway) return 'stay-away';
      return ready ? 'ended' : 'failed';
    } catch {
      return ready ? 'ended' : 'failed';
    } finally {
      clearTimeout(silence);
      stop.signal.removeEventListener('abort', abort);
      attempt.abort();
      onStatus(false);
    }
  }

  void (async () => {
    let failures = 0;
    while (!stop.signal.aborted) {
      const result = await readOnce();
      if (stop.signal.aborted || result === 'signed-out') return;

      if (result === 'stay-away') {
        await sleep(STAY_AWAY_MS, stop.signal);
      } else if (result === 'ended') {
        // A stream that worked and then ended (token expiry, a deploy): come straight back.
        failures = 0;
        await sleep(250 + Math.random() * 500, stop.signal);
      } else {
        failures += 1;
        const wait = Math.min(retryMs * 2 ** (failures - 1), MAX_RETRY_MS);
        await sleep(wait * (0.75 + Math.random() * 0.5), stop.signal);
      }
    }
  })();

  return () => stop.abort();
}

/**
 * Subscribe to live hints while the component is mounted and the tab is
 * visible. Returns true while the stream is connected, so callers can poll
 * slowly then and at their usual pace otherwise.
 */
export function useRealtime(onHint: (hint: RealtimeHint) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onHint);
  useEffect(() => {
    handler.current = onHint;
  }, [onHint]);

  useEffect(() => {
    let disconnect: (() => void) | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;

    const start = () => {
      clearTimeout(hideTimer);
      if (disconnect) return;
      disconnect = connect({
        onHint: (hint) => handler.current(hint),
        onStatus: (isConnected) => {
          setConnected(isConnected);
          if (!isConnected) return;
          // Coming back after a gap (hidden tab, lost network): catch up once.
          if (everConnected) handler.current('resync');
          everConnected = true;
        },
      });
    };
    const stop = () => {
      disconnect?.();
      disconnect = null;
      setConnected(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(stop, HIDDEN_GRACE_MS);
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(hideTimer);
      stop();
    };
  }, []);

  return connected;
}
