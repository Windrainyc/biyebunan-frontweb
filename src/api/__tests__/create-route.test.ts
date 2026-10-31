import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
const state = vi.hoisted(() => ({ route: undefined as any, push: vi.fn() }));
vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  useRouter: () => ({ push: state.push }),
}));
import { useCreateRoute } from '../../composables/useCreateRoute';
describe('独立新增页导航', () => {
  beforeEach(() => {
    state.route = reactive({
      params: { platform: 'admin', resource: 'projects', action: undefined },
      query: { q: '验收', status: 'ACTIVE' },
    });
    state.push.mockReset();
  });
  it('从带筛选的列表进入关联新增页并保留父记录', () => {
    useCreateRoute('delivery').open({ source: 'project-1' });
    expect(state.push).toHaveBeenCalledWith({
      path: '/admin/projects/new',
      query: { q: '验收', status: 'ACTIVE', form: 'delivery', source: 'project-1' },
    });
  });
  it('直接打开和前后退以路由为准，不依赖弹窗缓存', () => {
    const page = useCreateRoute('delivery');
    expect(page.active.value).toBe(false);
    state.route.params.action = 'new';
    state.route.query.form = 'delivery';
    expect(page.active.value).toBe(true);
    state.route.query.form = 'milestone';
    expect(page.active.value).toBe(false);
    state.route.query.form = 'delivery';
    state.route.params.action = undefined;
    expect(page.active.value).toBe(false);
  });
  it('返回列表清理新增上下文并保留业务筛选', () => {
    state.route.query.form = 'delivery';
    state.route.query.source = 'project-1';
    useCreateRoute('delivery').close();
    expect(state.push).toHaveBeenCalledWith({
      path: '/admin/projects',
      query: { q: '验收', status: 'ACTIVE' },
    });
  });
  it('中介新增不跨到管理平台', () => {
    state.route.params.platform = 'partner';
    state.route.params.resource = 'orders';
    useCreateRoute('order').open();
    expect(state.push.mock.calls[0][0].path).toBe('/partner/orders/new');
  });
});
