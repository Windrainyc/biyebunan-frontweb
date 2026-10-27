import { request } from './client';
import type { Page } from '../types/api';
export interface Menu {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  sortOrder: number;
}
export interface Navigation {
  configured: boolean;
  menus: Page<Menu>;
}
/** 获取全部可见导航页；异常不能解释为未配置，避免重新显示停用入口。 */
export async function loadNavigation(): Promise<{ configured: boolean; items: Menu[] }> {
  const items: Menu[] = [];
  let configured: boolean | undefined;
  for (let page = 1; page <= 100; page++) {
    const result = await request<Navigation>('/auth/navigation', { query: { page, size: 100 } });
    if (configured !== undefined && configured !== result.configured)
      throw new Error('菜单配置已变化，请重新加载');
    configured = result.configured;
    items.push(...result.menus.items);
    if (items.length >= result.menus.total) return { configured, items };
    if (!result.menus.items.length) throw new Error('菜单分页已变化，请重新加载');
  }
  throw new Error('菜单数量超过页面支持范围，请调整导航配置');
}
/** 只渲染当前端已实现路径，按树顺序显示；未知外链永不作为导航打开。 */
export function navigationLinks(items: Menu[], paths: Set<string>): (Menu & { depth: number })[] {
  const result: (Menu & { depth: number })[] = [],
    seen = new Set<string>();
  function walk(parent: string | null, depth: number) {
    for (const item of items
      .filter((m) => m.parentId === parent)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (paths.has(item.path)) result.push({ ...item, depth });
      walk(item.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}
