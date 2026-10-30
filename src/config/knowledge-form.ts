/** 隐藏当前内容类型不适用的字段，但保留编辑初始化所需的完整字段集合。 */
export function knowledgeFieldVisible(key: string, form: Record<string, unknown>): boolean {
  if (key === 'markdown') return form.type === 'MARKDOWN';
  if (key === 'assetId') return form.type !== 'MARKDOWN';
  if (key === 'projectId') return form.audience === 'PROJECT';
  return true;
}
