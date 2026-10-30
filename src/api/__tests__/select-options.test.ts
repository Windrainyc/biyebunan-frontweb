import { describe, expect, it } from 'vitest';
import { stableSelectOptions } from '../../components/select-options';
const options = () => [
  { value: 'one', label: '项目一', disabled: false },
  { value: 'two', label: '项目二', disabled: false },
];
describe('选项DOM反馈循环回归', () => {
  it('重复属性通知保留状态引用，连续同步达到稳定点', () => {
    const initial = options();
    let current = initial;
    for (let i = 0; i < 100; i++) current = stableSelectOptions(current, options());
    expect(current).toBe(initial);
  });
  it('异步移除和重排不能继续使用旧索引快照', () => {
    const initial = options();
    const reordered = [...initial].reverse();
    expect(stableSelectOptions(initial, reordered)).toBe(reordered);
    expect(stableSelectOptions(initial, [])).toEqual([]);
  });
  it('同一值的文案及禁用状态变化必须刷新', () => {
    const initial = options();
    const renamed = options();
    renamed[0]!.label = '项目一（已更新）';
    expect(stableSelectOptions(initial, renamed)).toBe(renamed);
    const disabled = options();
    disabled[0]!.disabled = true;
    expect(stableSelectOptions(initial, disabled)).toBe(disabled);
  });
});
