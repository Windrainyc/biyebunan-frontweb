import { describe, it, expect } from 'vitest';
import { requireOssUploadTarget } from '../upload-target';
describe('OSS direct upload target', () => {
  it('accepts a signed official bucket URL', () => {
    const url = 'https://biyebunanstudy.oss-cn-beijing.aliyuncs.com/documents/file?signature=test';
    expect(requireOssUploadTarget(url, 'PUT')).toBe(url);
  });
  it.each([
    'https://47.95.140.221:18781/api/v1/uploads',
    'http://biyebunanstudy.oss-cn-beijing.aliyuncs.com/file',
    'https://biyebunanstudy.oss-cn-beijing.aliyuncs.com.evil.example/file',
    'https://user:password@biyebunanstudy.oss-cn-beijing.aliyuncs.com/file',
  ])('rejects backend and untrusted target %s', (url) => {
    expect(() => requireOssUploadTarget(url, 'PUT')).toThrow();
  });
  it('rejects unexpected upload methods', () => {
    expect(() =>
      requireOssUploadTarget('https://biyebunanstudy.oss-cn-beijing.aliyuncs.com/file', 'POST'),
    ).toThrow();
  });
});
