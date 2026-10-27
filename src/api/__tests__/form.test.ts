import { describe, it, expect } from 'vitest';
import { formBody, requiresSelection } from '../../config/form';
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

it('字段必须出现不等于数组至少有一项，论坛可提交空标签和附件', () => {
  const field = { type: 'array', items: { type: 'string' } };
  expect(requiresSelection(field, true)).toBe(false);
  expect(requiresSelection({ ...field, minItems: 1 }, true)).toBe(true);
  expect(requiresSelection({ type: ['string', 'null'] }, true)).toBe(false);
  expect(requiresSelection({ type: 'string' }, true)).toBe(true);
  expect(
    formBody(
      { required: ['tagIds', 'assetIds'], properties: { tagIds: field, assetIds: field } },
      { tagIds: [], assetIds: [] },
    ),
  ).toEqual({ tagIds: [], assetIds: [] });
});
