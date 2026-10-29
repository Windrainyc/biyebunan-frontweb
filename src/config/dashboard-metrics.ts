export interface DashboardMetric {
  metric: string;
  value: string;
  unit: string;
  bucket: string;
}
/** 展示层按六位定点数累加金额，避免浮点舍入掩盖人工调整与迟到更正。 */
export function metricTotal(
  items: DashboardMetric[] | null,
  keys: readonly string[],
  money = false,
): string {
  if (items === null) return '—';
  let total = 0n;
  for (const item of items.filter((item) => keys.includes(item.metric))) {
    if (!money) {
      total += BigInt(item.value);
      continue;
    }
    if (!/^-?\d+(\.\d{1,6})?$/.test(item.value)) return '—';
    const [whole, fraction = ''] = item.value.replace(/^-/, '').split('.');
    total +=
      (BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'))) *
      (item.value.startsWith('-') ? -1n : 1n);
  }
  if (!money) return total.toLocaleString('zh-CN');
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? '-' : ''}${(absolute / 1000000n).toLocaleString('zh-CN')}.${(absolute % 1000000n).toString().padStart(6, '0')}`;
}
