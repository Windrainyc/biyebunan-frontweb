import type { Schema } from '../types/api';
/** 保留金额字符串；只有契约明确的整数/数值才转换，空的可空字段发送null。 */
export function formBody(fields: Schema, values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields.properties || {})) {
    if (field.readOnly) continue;
    const value = values[key];
    const nullable = Array.isArray(field.type) && field.type.includes('null');
    if (value === '' || value === undefined) {
      if (nullable) result[key] = null;
      else if (fields.required?.includes(key)) result[key] = value;
      continue;
    }
    if (field.format === 'date-time') {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) throw new Error('时间格式不正确');
      result[key] = date.toISOString();
      continue;
    }
    if (field.type === 'integer' || field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || (field.type === 'integer' && !Number.isSafeInteger(n)))
        throw new Error('数值超出允许范围');
      result[key] = n;
    } else result[key] = value;
  }
  return result;
}

/** OpenAPI required约束字段存在；数组是否至少选一项由minItems决定。 */
export function requiresSelection(field: Schema, required = false): boolean {
  if (!required || (Array.isArray(field.type) && field.type.includes('null'))) return false;
  return field.type !== 'array' || (field.minItems ?? 0) > 0;
}

/** 将时间转换为浏览器本地输入值，保留秒和毫秒，避免编辑计划时间时截断精度。 */
export function localDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}
