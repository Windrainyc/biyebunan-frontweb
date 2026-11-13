import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { auth, forget } from '../client';
import { loadCover } from '../../components/cover-loader';
import type { User } from '../../types/api';
beforeEach(() => {
  forget();
  auth.platform = 'student';
  auth.token = 'test';
  auth.user = { id: 'one' } as User;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.startsWith('/api/')
        ? new Response(JSON.stringify({ url: 'https://images.example/cover' }))
        : new Response(new Uint8Array([1, 2, 3])),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('并发相同封面只签发和下载一次', async () => {
  const [a, b] = await Promise.all([loadCover('asset', 800), loadCover('asset', 800)]);
  expect(a).toBe(b);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('variant=COVER_800');
});
it('不同尺寸独立请求，切换账户不能复用旧图', async () => {
  await loadCover('asset', 240);
  await loadCover('asset', 800);
  expect(fetch).toHaveBeenCalledTimes(4);
  auth.user = { id: 'two' } as User;
  await loadCover('asset', 800);
  expect(fetch).toHaveBeenCalledTimes(6);
});
it('失败不缓存，允许重新请求', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  await expect(loadCover('asset', 800)).rejects.toThrow();
  await loadCover('asset', 800);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('缓存超过45秒重新鉴权', async () => {
  await loadCover('asset', 800);
  const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 46000);
  await loadCover('asset', 800);
  expect(fetch).toHaveBeenCalledTimes(4);
  spy.mockRestore();
});
