import { it, expect } from 'vitest';
import { writeAttempt } from '../attempt';
it('同一内容保留幂等键，修正字段生成新键', () => {
  const attempt = writeAttempt();
  const first = attempt({ name: '原值' });
  expect(attempt({ name: '原值' })).toBe(first);
  expect(attempt({ name: '修正' })).not.toBe(first);
});
