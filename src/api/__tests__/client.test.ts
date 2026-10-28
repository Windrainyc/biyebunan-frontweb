import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { auth, forget, refresh, raw } from '../client';
const session = {
  accessToken: 'test-access',
  csrfToken: 'test-csrf',
  expiresIn: 600,
  platform: 'student',
  user: { id: 'test', displayName: '隔离测试', platform: 'student' },
};
beforeEach(() => {
  forget();
  auth.platform = 'student';
  vi.stubGlobal('document', { cookie: 'zx_student_csrf=isolated-test' });
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('navigator', {});
});
afterEach(() => vi.unstubAllGlobals());
describe('会话与幂等保护', () => {
  it('并发刷新只发出一次请求', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(session)));
    expect(await Promise.all([refresh(), refresh()])).toEqual([true, true]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('退出后到达的旧刷新结果不能恢复身份', async () => {
    let complete!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((r) => (complete = r)));
    const pending = refresh();
    forget();
    complete(new Response(JSON.stringify(session)));
    expect(await pending).toBe(false);
    expect(auth.token).toBe('');
  });
  it('跨入口的迟到刷新结果不能覆盖新入口', async () => {
    let complete!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((r) => (complete = r)));
    const pending = refresh();
    forget();
    auth.platform = 'admin';
    complete(new Response(JSON.stringify(session)));
    expect(await pending).toBe(false);
    expect(auth.platform).toBe('admin');
  });
  it('身份刷新后的写重试沿用幂等键', async () => {
    auth.token = 'expired';
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(session)))
      .mockResolvedValueOnce(new Response('{}'));
    await raw('/student/posts', {
      method: 'POST',
      body: { title: '测试' },
      key: 'isolated-idempotency-key',
    });
    const calls = vi.mocked(fetch).mock.calls;
    expect((calls[0]?.[1]?.headers as Record<string, string>)['Idempotency-Key']).toBe(
      (calls[2]?.[1]?.headers as Record<string, string>)['Idempotency-Key'],
    );
  });
  it('网络异常不自动重复写入', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network'));
    await expect(
      raw('/student/posts', { method: 'POST', body: { title: '测试' } }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('同源多标签刷新协调', () => {
  it('等到跨标签锁后读取最新CSRF Cookie', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lock = vi.fn(async (_name: string, action: () => Promise<boolean>) => {
      await gate;
      return action();
    });
    vi.stubGlobal('navigator', { locks: { request: lock } });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(session)));
    const pending = refresh();
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal('document', { cookie: 'zx_student_csrf=rotated-by-another-tab' });
    release();
    expect(await pending).toBe(true);
    expect(lock.mock.calls[0]?.[0]).toBe('zx:refresh:student');
    expect(
      (vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>)['X-CSRF-Token'],
    ).toBe('rotated-by-another-tab');
  });
  it('等待跨标签锁时退出，不再发送刷新请求', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, action: () => Promise<boolean>) => {
          await gate;
          return action();
        },
      },
    });
    const pending = refresh();
    forget();
    release();
    expect(await pending).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
