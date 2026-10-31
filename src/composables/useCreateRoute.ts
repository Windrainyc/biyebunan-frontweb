import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
/** 新增页保留列表筛选参数，支持直接访问、刷新和浏览器前后退。 */
export function useCreateRoute(kind: string) {
  const route = useRoute(),
    router = useRouter();
  const active = computed(() => route.params.action === 'new' && route.query.form === kind);
  const base = () => `/${route.params.platform}/${route.params.resource}`;
  function open(context: Record<string, string> = {}) {
    return router.push({
      path: base() + '/new',
      query: { ...route.query, form: kind, ...context },
    });
  }
  function close() {
    const { form: _form, source: _source, ...query } = route.query;
    return router.push({ path: base(), query });
  }
  return { active, open, close };
}
