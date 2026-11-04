import { describe, it, expect } from 'vitest';
import { activeSeconds } from './activity-time';
describe('可见活跃时间估算', () => {
  it('隐藏、失焦和长时间无交互不累计', () => {
    expect(activeSeconds(5000, false, true, 0)).toBe(0);
    expect(activeSeconds(5000, true, false, 0)).toBe(0);
    expect(activeSeconds(5000, true, true, 60000)).toBe(0);
  });
  it('休眠恢复和时钟回退不虚增时间', () => {
    expect(activeSeconds(300000, true, true, 1)).toBe(5);
    expect(activeSeconds(-1000, true, true, 1)).toBe(0);
    expect(activeSeconds(Infinity, true, true, 1)).toBe(0);
  });
  it('保留短片段，最多每次五秒', () => {
    expect(activeSeconds(1250, true, true, 300)).toBe(1.25);
    expect(activeSeconds(5000, true, true, 59999)).toBe(5);
  });
});
