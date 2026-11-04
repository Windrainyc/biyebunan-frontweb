import { describe, it, expect } from 'vitest';
import { knowledgeChapters } from '../../components/knowledgeChapters';
describe('知识阅读章节', () => {
  it('保留前言并按标题翻页，不丢失正文', () => {
    const chapters = knowledgeChapters('前言\n# 第一章\n正文一\n## 第二章\n正文二');
    expect(chapters.map((c) => c.title)).toEqual(['正文', '第一章', '第二章']);
    expect(chapters[2]?.text).toBe('## 第二章\n正文二');
  });
  it('代码中的标题不能被切成章节', () => {
    const content = '# 示例\n```md\n## 代码标题\n```\n## 下一章\n结束';
    expect(knowledgeChapters(content)).toHaveLength(2);
    expect(knowledgeChapters(content)[0]?.text).toContain('## 代码标题\n```');
  });
  it('无标题长文章保留完整内容供区内滚动', () => {
    const text = '连续正文\n'.repeat(1000);
    expect(knowledgeChapters(text)).toEqual([{ title: '正文', text }]);
  });
});
