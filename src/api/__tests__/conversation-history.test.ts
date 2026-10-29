import { describe, expect, it, vi } from 'vitest';
import { useConversationHistory } from '../../composables/useConversationHistory';
import type { Page, Row } from '../../types/api';
const result = (id: string, total = 1): Page<Row> => ({
  items: [{ id }],
  page: 1,
  size: 20,
  total,
});
function deferred() {
  let resolve!: (value: Page<Row>) => void;
  const promise = new Promise<Page<Row>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('会话历史隔离与恢复', () => {
  it('切换时立即清空旧正文，读取失败后重试当前会话', async () => {
    let id = 'a';
    const read = vi
      .fn()
      .mockResolvedValueOnce(result('old'))
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(result('new'));
    const history = useConversationHistory(() => id, read, String);
    await history.load();
    id = 'b';
    const pending = history.load();
    expect(history.messages.value).toEqual([]);
    await pending;
    expect(history.error.value).toContain('网络中断');
    expect(await history.retry()).toBe(true);
    expect(read).toHaveBeenLastCalledWith('b', 1);
    expect(history.messages.value.map((row) => row.id)).toEqual(['new']);
  });
  it('迟到的旧会话响应不得覆盖新会话', async () => {
    let id = 'a';
    const old = deferred();
    const history = useConversationHistory(
      () => id,
      vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(result('new')),
      String,
    );
    const pending = history.load();
    id = 'b';
    await history.load();
    old.resolve(result('old'));
    expect(await pending).toBe(false);
    expect(history.messages.value.map((row) => row.id)).toEqual(['new']);
  });
  it('更早页失败保留当前消息，重试不跳页', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(result('new', 21))
      .mockRejectedValueOnce(new Error('断网'))
      .mockResolvedValueOnce(result('old', 21));
    const history = useConversationHistory(() => 'a', read, String);
    await history.load();
    await history.load(true);
    expect(history.messages.value.map((row) => row.id)).toEqual(['new']);
    await history.retry();
    expect(read.mock.calls.map((call) => call[1])).toEqual([1, 2, 2]);
    expect(history.messages.value.map((row) => row.id)).toEqual(['old', 'new']);
  });
  it('新建会话和卸载使在途读取失效', async () => {
    let id = 'a';
    const old = deferred();
    const history = useConversationHistory(
      () => id,
      () => old.promise,
      String,
    );
    const pending = history.load();
    id = '';
    await history.load();
    history.dispose();
    old.resolve(result('old'));
    await pending;
    expect(history.messages.value).toEqual([]);
    expect(history.total.value).toBe(0);
    expect(history.loading.value).toBe(false);
  });
});
