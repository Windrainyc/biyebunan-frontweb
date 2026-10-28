/** 页面只提供安全的恢复入口，最终状态、资产隔离和权限仍由服务端事务检查。 */
export function jobRecovery(kind: string, state: string): { retry: boolean; message: string } {
  if (state !== 'FAILED') return { retry: false, message: '当前任务不是失败状态，无需重复派发。' };
  if (kind === 'BILLING_RECONCILIATION')
    return {
      retry: false,
      message: '请到词元用量重新提交核对，重新检查原调用证据。不能重新派发模型调用。',
    };
  if (kind.startsWith('PROBE_'))
    return { retry: false, message: '请回到对应配置重新验证连接，以采用当前配置版本。' };
  if (kind.startsWith('EXPORT_'))
    return { retry: false, message: '请在数据导出重新申请，重新核对权限和日期范围。' };
  if (kind === 'ASSET_VALIDATION' || kind === 'VIDEO_TRANSCODE')
    return {
      retry: true,
      message: '仅恢复技术失败。服务端会重新检查资产状态、版本与隔离结果，不会跳过安全扫描。',
    };
  if (kind === 'KNOWLEDGE_INDEX')
    return { retry: false, message: '请在知识库内容重新建立索引，以校验当前发布版本和代次。' };
  return { retry: false, message: '该任务不支持直接恢复，请检查任务类型及对应业务记录。' };
}
