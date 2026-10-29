/** 协议必须同时提供版本与安全公开地址；配置缺失时禁止注册，不伪造同意。 */
export function termsConfiguration(url: unknown, version: unknown) {
  if (typeof url !== 'string' || typeof version !== 'string' || !version.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (version.trim() === 'ui-test-nonbinding' && !local) return null;
    if (
      parsed.username ||
      parsed.password ||
      !(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local))
    )
      return null;
    return { url: parsed.toString(), version: version.trim() };
  } catch {
    return null;
  }
}
