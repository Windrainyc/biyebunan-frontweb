import { describe, it, expect } from 'vitest';
import { knowledgeFieldVisible } from '../../config/knowledge-form';
describe('知识库素材字段布局', () => {
  it('文档和视频显示上传入口，不显示无意义正文', () => {
    for (const type of ['DOCUMENT', 'VIDEO']) {
      expect(knowledgeFieldVisible('assetId', { type })).toBe(true);
      expect(knowledgeFieldVisible('markdown', { type })).toBe(false);
      expect(knowledgeFieldVisible('coverAssetId', { type })).toBe(true);
    }
  });
  it('图文保留正文和封面，不混入附件字段', () => {
    expect(knowledgeFieldVisible('markdown', { type: 'MARKDOWN' })).toBe(true);
    expect(knowledgeFieldVisible('assetId', { type: 'MARKDOWN' })).toBe(false);
    expect(knowledgeFieldVisible('coverAssetId', { type: 'MARKDOWN' })).toBe(true);
  });
  it('只有项目成员范围显示所属项目', () => {
    expect(knowledgeFieldVisible('projectId', { audience: 'PROJECT' })).toBe(true);
    expect(knowledgeFieldVisible('projectId', { audience: 'PUBLIC' })).toBe(false);
    expect(knowledgeFieldVisible('projectId', { audience: 'MEMBER' })).toBe(false);
  });
});
