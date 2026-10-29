import { describe, expect, it } from 'vitest';
import { inlineMarkdown, markdownBlocks, safeReadingLink } from '../../config/markdown';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MarkdownContent from '../../components/MarkdownContent.vue';
describe('知识阅读安全格式化', () => {
  it('区分标题、列表、引用和代码块，保留代码换行', () => {
    expect(
      markdownBlocks(
        '# 标题\n\n- 第一条\n- 第二条\n\n> 引用\n\n```java\nif (a < b) {\n  run();\n}\n```',
      ),
    ).toEqual([
      { kind: 'heading', level: 1, text: '标题' },
      { kind: 'list', ordered: false, items: ['第一条', '第二条'] },
      { kind: 'quote', text: '引用' },
      { kind: 'code', language: 'java', text: 'if (a < b) {\n  run();\n}' },
    ]);
  });
  it('有序和无序列表切换不丢内容', () => {
    expect(markdownBlocks('1. 一\n2. 二\n- 三')).toEqual([
      { kind: 'list', ordered: true, items: ['一', '二'] },
      { kind: 'list', ordered: false, items: ['三'] },
    ]);
  });
  it('表格行按标题列数补空，未闭合代码保持文本', () => {
    expect(markdownBlocks('| 名称 | 状态 |\n| --- | --- |\n| 测试 |')).toEqual([
      { kind: 'table', headers: ['名称', '状态'], rows: [['测试', '']] },
    ]);
    expect(markdownBlocks('```\n<script>alert(1)</script>')).toEqual([
      { kind: 'code', language: '', text: '<script>alert(1)</script>' },
    ]);
  });
  it('拒绝危险协议、控制字符、用户信息和协议相对链接', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,a',
      '//evil.test',
      'https://user:secret@example.test',
      'java\nscript:a',
      'javascript%3Aalert',
    ])
      expect(safeReadingLink(url)).toBeUndefined();
    expect(safeReadingLink('https://example.test/docs')).toBe('https://example.test/docs');
  });
  it('图片与不安全链接不生成外部请求入口', () => {
    expect(inlineMarkdown('![图](https://example.test/a.png)')).toEqual([
      { kind: 'text', text: '![图](https://example.test/a.png)' },
    ]);
    expect(inlineMarkdown('[链接](data:text/html,abc)')[0]?.kind).toBe('text');
  });
  it('Vue渲染原始HTML为转义文本，合法强调与链接保留', async () => {
    const result = await renderToString(
      createSSRApp({
        render: () =>
          h(MarkdownContent, {
            text: '<img src=x onerror=alert(1)>\n\n**说明** [文档](https://example.test/docs)',
          }),
      }),
    );
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
    expect(result).toContain('<strong>说明</strong>');
    expect(result).toContain('rel="noopener noreferrer"');
  });
});
