import { describe, expect, it } from 'vitest';
import { utilityNavigation } from '../../config/navigation-access';
import { operations } from '../../config/contract';
describe('专用页面导航权限', () => {
  it('裁决管理员不能看到统计导出和私聊审计入口', () => {
    const keys = utilityNavigation('admin', ['billing:adjudicate']).map((r) => r.key);
    expect(keys).not.toContain('statistics');
    expect(keys).not.toContain('exports');
    expect(keys).not.toContain('chat-audit');
  });
  it('完整管理员仍具有统计导出和审计入口', () => {
    const permissions = Object.values(operations)
      .map((o) => o.permission)
      .filter((p): p is string => !!p);
    expect(utilityNavigation('admin', permissions).map((r) => r.key)).toEqual(
      expect.arrayContaining(['statistics', 'exports', 'chat-audit']),
    );
  });
  it('任意权限不会把管理员专用页面跨端暴露给学生', () => {
    const permissions = Object.values(operations)
      .map((o) => o.permission)
      .filter((p): p is string => !!p);
    const links = utilityNavigation('student', permissions);
    expect(links.every((r) => r.path.startsWith('/student/'))).toBe(true);
    expect(links.map((r) => r.key)).not.toContain('chat-audit');
    expect(links.map((r) => r.key)).not.toContain('statistics');
    expect(links.map((r) => r.key)).toContain('bind-order');
  });
});
