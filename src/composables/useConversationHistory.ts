import { ref } from 'vue';
import { mergeMessagePage } from '../api/messages';
import type { Page, Row } from '../types/api';

/** 会话切换立即撤下旧正文；翻页失败保留当前会话，迟到响应不得跨会话覆盖。 */
export function useConversationHistory(
  conversationId: () => string,
  readPage: (id: string, page: number) => Promise<Page<Row>>,
  describeError: (error: unknown) => string,
) {
  const messages = ref<Row[]>([]),
    total = ref(0),
    loading = ref(false),
    error = ref('');
  let generation = 0,
    page = 0,
    loadedId = '',
    retryOlder = false,
    disposed = false;
  async function load(older = false): Promise<boolean> {
    const id = conversationId(),
      current = ++generation;
    const append = older && loadedId === id;
    error.value = '';
    retryOlder = append;
    if (!append) {
      messages.value = [];
      total.value = 0;
      page = 0;
      loadedId = id;
    }
    if (!id || disposed) {
      loading.value = false;
      return false;
    }
    loading.value = true;
    const targetPage = append ? page + 1 : 1;
    try {
      const result = await readPage(id, targetPage);
      if (disposed || current !== generation || conversationId() !== id) return false;
      messages.value = mergeMessagePage(result.items, append ? messages.value : []);
      total.value = result.total;
      page = targetPage;
      return true;
    } catch (e) {
      if (!disposed && current === generation) error.value = describeError(e);
      return false;
    } finally {
      if (!disposed && current === generation) loading.value = false;
    }
  }
  function dispose() {
    disposed = true;
    generation++;
  }
  return { messages, total, loading, error, load, retry: () => load(retryOlder), dispose };
}
