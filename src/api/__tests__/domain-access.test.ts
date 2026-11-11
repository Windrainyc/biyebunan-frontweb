import { describe, expect, it } from 'vitest';
import { domainUrl, loginUrl } from '../../config/domain-access';
describe('域名访问链接', () => {
  it('仅生成DNS主机的HTTPS链接', () => {
    expect(domainUrl(' ADMIN.BIYEBUNAN.COM ')).toBe('https://admin.biyebunan.com');
    for (const value of [
      'javascript:alert(1)',
      'https://example.com',
      'a.com/path',
      'a.com:443',
      'a.com@evil.com',
      '-bad.example.com',
      '127.0.0.1',
    ])
      expect(domainUrl(value)).toBeUndefined();
  });
  it('入口绑定已知平台且不接受带凭据或额外路径的URL', () => {
    expect(loginUrl('http://127.0.0.1:18770', 'student')).toBe(
      'http://127.0.0.1:18770/student/login',
    );
    expect(loginUrl('https://admin.biyebunan.com', 'admin')).toBe(
      'https://admin.biyebunan.com/admin/login',
    );
    for (const value of [
      'javascript:alert(1)',
      'https://user:pass@a.com',
      'https://a.com/path',
      'https://a.com/#hash',
    ])
      expect(loginUrl(value, 'admin')).toBeUndefined();
    expect(loginUrl('https://a.com', 'other')).toBeUndefined();
  });
});
