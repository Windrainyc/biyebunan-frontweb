import { describe, it, expect } from 'vitest';
import { selectLayout } from '../../components/select-layout';
describe('下拉菜单视口定位', () => {
  it('短触发器提供完整标签宽度', () => {
    expect(
      selectLayout({ left: 16, top: 100, bottom: 140, width: 100 }, { width: 800, height: 700 }),
    ).toMatchObject({ left: '16px', width: '220px', top: '146px' });
  });
  it('右边缘向左收回且底部不足时向上展开', () => {
    expect(
      selectLayout({ left: 700, top: 640, bottom: 680, width: 90 }, { width: 800, height: 700 }),
    ).toMatchObject({ left: '572px', width: '220px', bottom: '66px' });
  });
  it('极窄视口仍留安全边距', () => {
    expect(
      selectLayout({ left: 16, top: 100, bottom: 140, width: 300 }, { width: 200, height: 400 }),
    ).toMatchObject({ left: '8px', width: '184px' });
  });
});
