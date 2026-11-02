import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../client', () => ({ auth: { platform: 'admin', permissions: [] } }));
import { auth } from '../client';
import { operations } from '../../config/contract';
import { recordActions } from '../../config/record-actions';
describe('列表业务处理权限与状态', () => {
  beforeEach(() => {
    auth.platform = 'admin';
    auth.permissions = Object.values(operations).flatMap((o) =>
      o.permission ? [o.permission] : [],
    );
  });
  it('草稿只能提交审核，审核中才允许发布', () => {
    expect(recordActions('contents', { state: 'DRAFT' }).map((a) => a.title)).toContain('提交审核');
    expect(recordActions('contents', { state: 'DRAFT' }).map((a) => a.title)).not.toContain(
      '发布内容',
    );
    expect(recordActions('contents', { state: 'REVIEW' }).map((a) => a.title)).toContain(
      '发布内容',
    );
  });
  it('没有权限不显示处理入口', () => {
    auth.permissions = [];
    expect(recordActions('contents', { state: 'REVIEW' })).toEqual([]);
  });
  it('收款核验仅用于已确认且未核验订单', () => {
    expect(
      recordActions('orders', { status: 'CONFIRMED', receiptStatus: 'UNCONFIRMED' }).some((a) =>
        a.path.endsWith('/receipt'),
      ),
    ).toBe(true);
    expect(
      recordActions('orders', { status: 'DRAFT', receiptStatus: 'UNCONFIRMED' }).some((a) =>
        a.path.endsWith('/receipt'),
      ),
    ).toBe(false);
  });
  it('已处理举报不显示再次裁决', () => {
    expect(recordActions('reports', { state: 'RESOLVED' })).toEqual([]);
  });
});
