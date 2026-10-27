/** 同一请求内容重试沿用键；用户修正内容后开启新尝试，避免幂等冲突。 */
export function writeAttempt() {
  let fingerprint = '',
    key = '';
  return (body: unknown) => {
    const next = JSON.stringify(body);
    if (next !== fingerprint) {
      fingerprint = next;
      key = crypto.randomUUID();
    }
    return key;
  };
}
