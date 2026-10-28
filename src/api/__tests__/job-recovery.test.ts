import { describe, it, expect } from 'vitest';
import { jobRecovery } from '../../config/job-recovery';
describe('任务恢复入口遵守不同副作用边界', () => {
  it('已运行、排队及成功任务不重复派发', () => {
    for (const state of ['QUEUED', 'RUNNING', 'SUCCEEDED', 'CANCELLED', 'UNKNOWN'])
      expect(jobRecovery('ASSET_VALIDATION', state).retry).toBe(false);
  });
  it('失败账务核对不能通过通用重试变成模型重派', () => {
    expect(jobRecovery('BILLING_RECONCILIATION', 'FAILED').retry).toBe(false);
    expect(jobRecovery('BILLING_RECONCILIATION', 'FAILED').message).toContain(
      '不能重新派发模型调用',
    );
  });
  it('导出、探测、知识代次重新走原业务入口，未知类型默认禁止', () => {
    for (const kind of ['EXPORT_USAGE', 'PROBE_MODEL', 'KNOWLEDGE_INDEX', 'FUTURE_JOB'])
      expect(jobRecovery(kind, 'FAILED').retry).toBe(false);
  });
  it('只有失败扫描和转码显示受控恢复，并强调服务端安全检查', () => {
    for (const kind of ['ASSET_VALIDATION', 'VIDEO_TRANSCODE']) {
      expect(jobRecovery(kind, 'FAILED').retry).toBe(true);
      expect(jobRecovery(kind, 'FAILED').message).toContain('不会跳过安全扫描');
    }
  });
});
