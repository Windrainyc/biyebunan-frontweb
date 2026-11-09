/** 文件只允许浏览器直接 PUT 到官方 OSS 公网桶，禁止回退到应用后台。 */
export function requireOssUploadTarget(raw: string, method: string): string {
  const url = new URL(raw);
  if (
    method !== 'PUT' ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname)
  )
    throw new Error('上传授权地址不是有效的 OSS 直传地址，请检查存储配置');
  return url.href;
}
