/** 列表查询参数与记录入口共用URL，返回时恢复筛选及分页。 */
export function listLocation(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)]),
  );
}
export function positivePage(value: unknown, fallback = 1) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
