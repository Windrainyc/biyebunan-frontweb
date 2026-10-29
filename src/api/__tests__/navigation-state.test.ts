import { expect, it } from 'vitest';
import { useNavigationState } from '../../composables/useNavigationState';
const first = {
  configured: true,
  items: [{ id: 'a', parentId: null, name: '项目', path: '/student/projects', sortOrder: 0 }],
};
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it('同一身份菜单刷新期间保持现有导航，成功后原子替换', async () => {
  let task = deferred<typeof first>();
  const state = useNavigationState(
    () => 'student:a',
    () => task.promise,
    String,
  );
  const initial = state.refresh();
  task.resolve(first);
  await initial;
  task = deferred();
  const refresh = state.refresh();
  expect(state.navigation.value).toEqual(first);
  const empty = { configured: true, items: [] };
  task.resolve(empty);
  await refresh;
  expect(state.navigation.value).toEqual(empty);
});
it('刷新失败清理菜单并保留错误，不能恢复默认导航', async () => {
  let task = deferred<typeof first>();
  const state = useNavigationState(
    () => 'student:a',
    () => task.promise,
    String,
  );
  const initial = state.refresh();
  task.resolve(first);
  await initial;
  task = deferred();
  const refresh = state.refresh();
  task.reject(new Error('失效'));
  await refresh;
  expect(state.navigation.value).toBeNull();
  expect(state.error.value).toContain('失效');
});
it('切换身份立即清理且旧请求不能覆盖新身份菜单', async () => {
  let owner = 'student:a',
    task = deferred<typeof first>();
  const state = useNavigationState(
    () => owner,
    () => task.promise,
    String,
  );
  const initial = state.refresh();
  task.resolve(first);
  await initial;
  task = deferred();
  const old = task,
    late = state.refresh();
  owner = 'student:b';
  task = deferred();
  const current = state.refresh();
  expect(state.navigation.value).toBeNull();
  task.resolve({ configured: true, items: [] });
  await current;
  old.resolve(first);
  await late;
  expect(state.navigation.value?.items).toEqual([]);
});
it('离开工作区后菜单请求不能回填', async () => {
  const task = deferred<typeof first>();
  const state = useNavigationState(
    () => 'student:a',
    () => task.promise,
    String,
  );
  const pending = state.refresh();
  state.dispose();
  task.resolve(first);
  await pending;
  expect(state.navigation.value).toBeNull();
});
