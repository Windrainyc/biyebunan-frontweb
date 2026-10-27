import { auth, ApiError, refresh } from './client';
/** 按SSE空行拆帧，保留跨网络分片的UTF-8与未完成行。 */
export async function events(
  runId: string,
  cursor: number,
  signal: AbortSignal,
  receive: (event: RunEvent) => void,
) {
  async function connect() {
    return fetch(`/api/v1/student/runs/${runId}/events`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${auth.token}`,
        ...(cursor ? { 'Last-Event-ID': `${runId}:${cursor}` } : {}),
      },
      signal,
      credentials: 'same-origin',
    });
  }
  let response = await connect();
  if (response.status === 401 && (await refresh())) response = await connect();
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  if (!response.body) throw new Error('浏览器未提供流式响应');
  const reader = response.body.getReader(),
    decoder = new TextDecoder(),
    parser = new SseParser();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const data of parser.push(decoder.decode(chunk.value, { stream: true }))) {
        const event = JSON.parse(data) as RunEvent;
        if (event.runId !== runId || !Number.isSafeInteger(event.sequence))
          throw new Error('流事件标识不一致');
        if (event.sequence <= cursor) continue;
        if (event.sequence !== cursor + 1) throw new Error('答疑事件存在缺口，请重新连接');
        receive(event);
        cursor = event.sequence;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export interface RunEvent {
  runId: string;
  sequence: number;
  type: string;
  data: {
    text?: string;
    state?: string;
    errorCode?: string;
    [key: string]: unknown;
  };
}
export class SseParser {
  private pending = '';
  push(chunk: string): string[] {
    this.pending += chunk;
    const result: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.pending))) {
      const frame = this.pending.slice(0, match.index);
      this.pending = this.pending.slice(match.index + match[0].length);
      const lines = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''));
      if (lines.length) result.push(lines.join('\n'));
    }
    if (this.pending.length > 2_000_000) throw new Error('流事件超过允许长度');
    return result;
  }
}
