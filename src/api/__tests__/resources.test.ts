import { describe, it, expect } from 'vitest';
import { resources } from '../../config/resources';
import { operation, schema, updateMethod } from '../../config/contract';
describe('页面列表与真实接口字段保持一致', () => {
  for (const platform of ['admin', 'student', 'partner'] as const) {
    for (const resource of resources(platform)) {
      it(`${platform} ${resource.title}`, () => {
        const op = operation('GET', resource.path);
        expect(op, resource.path).toBeDefined();
        const page = schema(op?.response),
          row = schema(schema(page.properties?.items).items);
        for (const key of resource.columns)
          expect(row.properties, `${resource.path}缺少字段${key}`).toHaveProperty(key);
      });
    }
  }
});

describe('更新方法遵循后端契约', () => {
  it('中介订单使用PATCH且不能修改金额归属', () => {
    expect(updateMethod('/partner/orders')).toBe('PATCH');
    const fields = schema(operation('PATCH', '/partner/orders/{id}')?.body);
    expect(Object.keys(fields.properties || {})).toEqual(['schoolId', 'majorId', 'note']);
  });
  it('管理员订单使用PUT，学生订单保持只读', () => {
    expect(updateMethod('/admin/orders')).toBe('PUT');
    expect(updateMethod('/student/orders')).toBeUndefined();
  });
});
