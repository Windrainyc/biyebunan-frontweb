import { request } from './client';
import type { Page, Row } from '../types/api';
/** 当前会话的公开字典短时缓存；不用于私有文件、项目或权限判断。 */
const cache = new Map<string, { expires: number; value: Promise<Row[]> }>();
export async function dictionaryRows(path: string, accountId: string): Promise<Row[]> {
  const key = `${accountId}:${path}`;
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  const value = (async () => {
    const rows: Row[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await request<Page<Row>>(path, { query: { page, size: 100 } });
      rows.push(...result.items);
      if (!result.items.length || rows.length >= result.total) break;
    }
    return rows;
  })();
  cache.set(key, { expires: Date.now() + 30000, value });
  try {
    return await value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}
