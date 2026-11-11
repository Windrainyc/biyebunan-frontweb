/** 访问链接只接受规范DNS主机；不把用户输入拼成任意协议或路径。 */
export function domainUrl(value: unknown): string | undefined {
  const host = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return;
  return `https://${host}`;
}
export function loginUrl(origin: string, platform: string): string | undefined {
  if (!['student', 'admin', 'partner'].includes(platform)) return;
  try {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      return;
    return `${url.origin}/${platform}/login`;
  } catch {
    return;
  }
}
