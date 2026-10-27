import type { Row } from '../types/api';

/** 服务端倒序页转换为聊天时间顺序；翻页重叠时保留既有消息且不重复。 */
export function mergeMessagePage(newestFirst: Row[], existing: Row[]): Row[] {
  const seen = new Set(existing.map((row) => row.id));
  const older = [...newestFirst].reverse().filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return [...older, ...existing];
}
