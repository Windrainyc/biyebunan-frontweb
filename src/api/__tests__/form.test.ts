import { describe, it, expect } from 'vitest';
import { formBody } from '../../config/form';
describe('表单契约转换', () => {
  it('可空关联保留null且金额保持字符串', () => {
    expect(
      formBody(
        {
          required: ['parentId', 'amount'],
          properties: {
            parentId: { type: ['string', 'null'] },
            amount: { type: 'string' },
            count: { type: 'integer' },
          },
        },
        { parentId: '', amount: '0.123456', count: '8' },
      ),
    ).toEqual({ parentId: null, amount: '0.123456', count: 8 });
  });
  it('不能把超出安全整数的输入静默舍入', () => {
    expect(() =>
      formBody({ properties: { count: { type: 'integer' } } }, { count: '9007199254740993' }),
    ).toThrow();
  });
});
