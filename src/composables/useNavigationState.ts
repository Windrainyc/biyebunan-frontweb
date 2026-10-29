import { shallowRef, ref } from 'vue';
import type { Menu } from '../api/navigation';

type Snapshot = { configured: boolean; items: Menu[] };
/** 同一身份刷新保留导航几何结构；跨身份立即清空，失败不回退为默认菜单。 */
export function useNavigationState(
  identity: () => string,
  read: () => Promise<Snapshot>,
  describeError: (error: unknown) => string,
) {
  const navigation = shallowRef<Snapshot | null>(null);
  const error = ref('');
  let owner = '',
    generation = 0,
    disposed = false;
  async function refresh() {
    const nextOwner = identity(),
      current = ++generation;
    if (nextOwner !== owner) {
      navigation.value = null;
      owner = nextOwner;
    }
    error.value = '';
    try {
      const value = await read();
      if (!disposed && current === generation && identity() === nextOwner) navigation.value = value;
    } catch (cause) {
      if (!disposed && current === generation && identity() === nextOwner) {
        navigation.value = null;
        error.value = describeError(cause);
      }
    }
  }
  function dispose() {
    disposed = true;
    generation++;
  }
  return { navigation, error, refresh, dispose };
}
