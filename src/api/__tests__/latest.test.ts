import { describe, expect, it } from 'vitest';
import { latestRequest } from '../latest';

describe('弹窗异步读取', () => {
  it('后打开的记录先返回时，旧响应不能覆盖当前记录', async () => {
    const guard = latestRequest();
    let finishOld!: (v: string) => void;
    let visible = '';
    const old = guard.start();
    const pending = new Promise<string>((resolve) => {
      finishOld = resolve;
    }).then((value) => {
      if (old()) visible = value;
    });
    const current = guard.start();
    if (current()) visible = '新记录';
    finishOld('旧记录');
    await pending;
    expect(visible).toBe('新记录');
  });
  it('关闭或卸载后所有在途读取失效，再打开可正常读取', () => {
    const guard = latestRequest();
    const pending = guard.start();
    guard.invalidate();
    expect(pending()).toBe(false);
    expect(guard.start()()).toBe(true);
  });
});
