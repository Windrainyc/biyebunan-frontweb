import { watch } from 'vue';
import { auth, request } from '../api/client';
import { previewBlob } from './material-preview';

// 仅内存短时复用，最长不超过签名期限；退出、切换账户立即丢弃。
const cache = new Map<string, { until: number; promise: Promise<Blob> }>();
watch(
  () => [auth.platform, auth.user?.id],
  () => cache.clear(),
  { flush: 'sync' },
);
export function loadCover(id: string, width: 240 | 800 | 1600): Promise<Blob> {
  const key = `${auth.platform}:${auth.user?.id}:${id}:${width}`;
  const now = Date.now();
  for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
  const hit = cache.get(key);
  if (hit) return hit.promise;
  const platform = auth.platform;
  const promise = request<{ url: string }>(
    `/${platform}/assets/${encodeURIComponent(id)}/download?variant=COVER_${width}`,
    { method: 'POST' },
  )
    .then((grant) => previewBlob(grant.url, 'image/webp', AbortSignal.timeout(30000)))
    .catch((error) => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    });
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, { until: now + 45000, promise });
  return promise;
}
