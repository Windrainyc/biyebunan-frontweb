import { describe, expect, it } from 'vitest';
import { formBody, localDateTime } from '../../config/form';

describe('计划时间精度', () => {
  it('本地控件值往返保留秒、毫秒和同一时刻', () => {
    const original = '2027-01-01T04:12:34.567Z';
    const local = localDateTime(original);
    expect(local).toMatch(/T\d{2}:\d{2}:34\.567$/);
    expect(
      formBody(
        { properties: { effectiveFrom: { type: 'string', format: 'date-time' } } },
        { effectiveFrom: local },
      ),
    ).toEqual({ effectiveFrom: original });
  });
  it('空值保持空白，非法值交给提交校验拒绝', () => {
    expect(localDateTime(null)).toBe('');
    expect(localDateTime('bad-date')).toBe('bad-date');
    expect(() =>
      formBody(
        { properties: { effectiveFrom: { format: 'date-time' } } },
        { effectiveFrom: localDateTime('bad-date') },
      ),
    ).toThrow('时间格式不正确');
  });
});
