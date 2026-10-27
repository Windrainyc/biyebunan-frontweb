import { describe, it, expect } from 'vitest';
import { resources } from '../../config/resources';
import { operation, schema } from '../../config/contract';
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
