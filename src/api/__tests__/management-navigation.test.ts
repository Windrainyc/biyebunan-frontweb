import { describe, it, expect } from 'vitest';
import { managementSections } from '../../config/management-navigation';
import { resources } from '../../config/resources';
import { utilityNavigation } from '../../config/navigation-access';
import { operations } from '../../config/contract';
import { metricTotal } from '../../config/dashboard-metrics';
describe('原型栏目与授权入口', () => {
  it('全部管理员功能都归入栏目且不丢失或重复', () => {
    const permissions = Object.values(operations).flatMap((o) =>
      o.permission ? [o.permission] : [],
    );
    const links = [
      ...resources('admin').map((r) => ({ ...r, path: '/admin/' + r.key })),
      ...utilityNavigation('admin', permissions),
    ];
    const grouped = managementSections(links).flatMap((section) =>
      section.links.map((l) => l.path),
    );
    expect(grouped.sort()).toEqual(links.map((l) => l.path).sort());
  });
  it('只有裁决权限时不能通过栏目补回模型和私聊入口', () => {
    const sections = managementSections([
      { key: 'adjudications', title: '裁决', path: '/admin/adjudications', icon: 'shield' },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.links.map((link) => link.key)).toEqual(['adjudications']);
    expect(managementSections([])).toEqual([]);
  });
});
describe('总览账务数值', () => {
  const metric = (metric: string, value: string) => ({
    metric,
    value,
    unit: 'CNY',
    bucket: '2026-10-29',
  });
  it('原结算、负向更正和人工调整按六位精度合计', () => {
    expect(
      metricTotal(
        [
          metric('settle', '0.100001'),
          metric('correction', '-0.100002'),
          metric('adjust', '-2.000001'),
        ],
        ['settle', 'correction', 'adjust'],
        true,
      ),
    ).toBe('-2.000002');
  });
  it('加载失败保持未知，真实空集合才显示零', () => {
    expect(metricTotal(null, ['settle'], true)).toBe('—');
    expect(metricTotal([], ['settle'], true)).toBe('0.000000');
  });
});
