import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../client', () => ({ request: vi.fn() }));
import { request } from '../client';
import { loadNavigation, navigationLinks, type Menu } from '../navigation';
const call = vi.mocked(request);
beforeEach(() => call.mockReset());
it('全部不可见仍保留已配置标记，不恢复默认导航', async () => {
  call.mockResolvedValue({ configured: true, menus: { items: [], total: 0, page: 1, size: 100 } });
  expect(await loadNavigation()).toEqual({ configured: true, items: [] });
});
it('加载所有分页，失败不能转换成未配置', async () => {
  call.mockResolvedValueOnce({ configured: true, menus: { items: [{ id: 'a' }], total: 2 } });
  call.mockResolvedValueOnce({ configured: true, menus: { items: [{ id: 'b' }], total: 2 } });
  expect((await loadNavigation()).items).toHaveLength(2);
  expect(call).toHaveBeenLastCalledWith('/auth/navigation', { query: { page: 2, size: 100 } });
  call.mockRejectedValueOnce(new Error('不可用'));
  await expect(loadNavigation()).rejects.toThrow('不可用');
});
it('树顺序和当前端路径白名单阻止跨端及外部导航', () => {
  const items: Menu[] = [
    { id: 'child', parentId: 'root', name: '项目', path: '/student/projects', sortOrder: 0 },
    { id: 'root', parentId: null, name: '分组', path: '/group', sortOrder: 0 },
    { id: 'evil', parentId: null, name: '外链', path: 'https://evil.invalid', sortOrder: 1 },
    { id: 'admin', parentId: null, name: '管理', path: '/admin/users', sortOrder: 2 },
  ];
  expect(navigationLinks(items, new Set(['/student/projects']))).toEqual([
    { ...items[0], depth: 1 },
  ]);
});
