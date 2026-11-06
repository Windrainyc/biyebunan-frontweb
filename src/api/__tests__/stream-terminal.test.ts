import { afterEach, describe, expect, it, vi } from 'vitest';
import { events } from '../stream';
vi.mock('../client', () => ({ auth: { token: 'test' }, refresh: vi.fn(), ApiError: Error }));
afterEach(() => vi.unstubAllGlobals());
describe('答疑流终态释放', () => {
  it.each(['completed', 'failed', 'cancelled'])(
    '收到 %s 后即使代理不关闭也结束读取',
    async (type) => {
      const cancel = vi.fn();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ runId: 'run', sequence: 1, type, data: {} })}\n\n`,
            ),
          );
          // 故意不 close，模拟代理保留连接。
        },
        cancel,
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
      const received = vi.fn();
      await events('run', 0, new AbortController().signal, received);
      expect(received).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );
  it('事件缺口仍拒绝处理，不能误判完成', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"runId":"run","sequence":2,"type":"completed","data":{}}\n\n',
          ),
        );
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
    await expect(events('run', 0, new AbortController().signal, vi.fn())).rejects.toThrow('缺口');
  });
});
