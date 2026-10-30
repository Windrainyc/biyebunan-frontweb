import { describe, it, expect } from 'vitest';
import { requiresMarkdownSource } from '../../config/editor-markdown';
describe('编辑器保留复杂原文', () => {
  it('基础格式可视化编辑', () =>
    expect(requiresMarkdownSource('# 标题\n\n**粗体**\n- 列表')).toBe(false));
  it('图片HTML表格任务列表保留源码', () => {
    for (const text of [
      '![图片](https://example.com/a.png)',
      '<iframe src="x">',
      '| a | b |\n|---|---|',
      '- [x] 完成',
      '[ref]: https://example.com',
    ])
      expect(requiresMarkdownSource(text)).toBe(true);
  });
  it('代码中的HTML不是格式降级条件', () =>
    expect(requiresMarkdownSource('```html\n<div>test</div>\n```')).toBe(false));
});
