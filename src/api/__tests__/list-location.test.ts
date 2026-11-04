import { describe, it, expect } from 'vitest';
import { listLocation, positivePage } from '../../config/list-location';
describe('列表上下文保留', () => {
  it('保留false和多选值，移除未选择字段', () => {
    expect(listLocation({ active: false, tags: ['a', 'b'], q: '', empty: null, page: 3 })).toEqual({
      active: 'false',
      tags: ['a', 'b'],
      page: '3',
    });
  });
  it('不接受非法页码', () => {
    for (const value of ['-1', 'NaN', '1.5', '0', []]) expect(positivePage(value)).toBe(1);
    expect(positivePage('4')).toBe(4);
  });
});
