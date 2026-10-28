import { describe, expect, it } from 'vitest';
import { termsConfiguration } from '../../config/terms';
describe('注册协议配置', () => {
  it('地址与版本缺一不可', () => {
    expect(termsConfiguration(undefined, 'v1')).toBeNull();
    expect(termsConfiguration('https://example.com/terms', '')).toBeNull();
  });
  it('拒绝脚本协议、嵌入凭据与远程明文地址', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://user:secret@example.com/',
      'http://example.com/terms',
    ])
      expect(termsConfiguration(url, 'v1')).toBeNull();
  });
  it('支持公开HTTPS与隔离本机HTTP测试地址', () => {
    expect(termsConfiguration('https://example.com/terms', ' v1 ')).toEqual({
      url: 'https://example.com/terms',
      version: 'v1',
    });
    expect(termsConfiguration('http://127.0.0.1:18780/terms', 'local-test')).not.toBeNull();
  });
});
