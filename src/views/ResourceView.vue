<script setup lang="ts">
import { listLocation, positivePage } from '../config/list-location';
import PartnerStudentOrders from '../components/PartnerStudentOrders.vue';
import AppSelect from '../components/AppSelect.vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import RequirementAttachments from '../components/RequirementAttachments.vue';
import WorkflowPage from '../components/WorkflowPage.vue';
import { recordActions } from '../config/record-actions';
import CreatePage from '../components/CreatePage.vue';
import { latestRequest } from '../api/latest';
import { writeAttempt } from '../api/attempt';
import { computed, onMounted, onBeforeUnmount, ref, watch, defineAsyncComponent } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation, schema, updateMethod } from '../config/contract';
import { label, display } from '../config/labels';
import type { Resource } from '../config/resources';
import { studentPostActions } from '../config/forum-actions';
import type { Row, Page } from '../types/api';
const InvitationDetail = defineAsyncComponent(() => import('../components/InvitationDetail.vue'));
const UsageDetail = defineAsyncComponent(() => import('../components/UsageDetail.vue'));
const OrderDetail = defineAsyncComponent(() => import('../components/OrderDetail.vue'));
const StudentReadingDialog = defineAsyncComponent(
  () => import('../components/StudentReadingDialog.vue'),
);
const KnowledgeDetail = defineAsyncComponent(() => import('../components/KnowledgeDetail.vue'));
const PartnerInvitation = defineAsyncComponent(() => import('../components/PartnerInvitation.vue'));
const MembershipDetail = defineAsyncComponent(() => import('../components/MembershipDetail.vue'));
import ReferenceName from '../components/ReferenceName.vue';
const ForumDetail = defineAsyncComponent(() => import('../components/ForumDetail.vue'));
import RecordActions from '../components/RecordActions.vue';
const StudentProjectSpace = defineAsyncComponent(
  () => import('../components/StudentProjectSpace.vue'),
);
const ProjectDetail = defineAsyncComponent(() => import('../components/ProjectDetail.vue'));
import StatusBadge from '../components/StatusBadge.vue';
import Icon from '../components/Icon.vue';
import KnowledgeCategoryNav from '../components/KnowledgeCategoryNav.vue';
import ForumSidebar from '../components/ForumSidebar.vue';
import { formBody, requiresSelection } from '../config/form';
import AssetCover from '../components/AssetCover.vue';
import { knowledgeFieldVisible } from '../config/knowledge-form';
import SchemaField from '../components/SchemaField.vue';
let attempt = writeAttempt();
const editRead = latestRequest(),
  detailRead = latestRequest();
const jumpPage = ref(1);
function jump() {
  page.value = Math.min(
    Math.max(1, Math.ceil(total.value / size.value)),
    positivePage(jumpPage.value),
  );
  void load();
}
const initialForm = ref('');
const listScroll = ref(0);
const dirty = computed(() => formOpen.value && JSON.stringify(form.value) !== initialForm.value);
const discardOpen = ref(false);
let discardResolve: ((value: boolean) => void) | undefined;
function confirmLeave(): boolean | Promise<boolean> {
  if (!dirty.value || saving.value) return true;
  if (discardResolve) return false;
  discardOpen.value = true;
  return new Promise((resolve) => {
    discardResolve = resolve;
  });
}
function finishDiscard(value: boolean) {
  discardOpen.value = false;
  if (value) initialForm.value = JSON.stringify(form.value);
  discardResolve?.(value);
  discardResolve = undefined;
}
onBeforeUnmount(() => discardResolve?.(false));
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
function unload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onMounted(() => window.addEventListener('beforeunload', unload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', unload));
async function closeForm() {
  if (!(await confirmLeave())) return;
  editRead.invalidate();
  formOpen.value = false;
  requestAnimationFrame(() => window.scrollTo(0, listScroll.value));
  if (creatingPage.value || route.query.edit) {
    const { edit, ...query } = route.query;
    void router.push({ path: `/${auth.platform}/${props.resource.key}`, query });
  }
}
function closeDetail() {
  detailRead.invalidate();
  detail.value = null;
  requestAnimationFrame(() => window.scrollTo(0, listScroll.value));
  if (route.query.view) {
    const { view, section, ...query } = route.query;
    void router.push({ path: route.path, query });
  }
}
const props = defineProps<{ resource: Resource }>();
const route = useRoute();
const router = useRouter();
const creatingPage = computed(() => route.params.action === 'new' && !route.query.form);
function listQuery() {
  listScroll.value = window.scrollY;
  const preserved = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !queryNames.value.has(key)),
  );
  return {
    ...preserved,
    ...listLocation({
      ...extraFilters.value,
      q: q.value,
      status: status.value,
      sort: sort.value,
      page: page.value,
      size: size.value,
    }),
  };
}
function beginCreate() {
  void router.push({ path: `/${auth.platform}/${props.resource.key}/new`, query: listQuery() });
}
const studentCards = computed(
  () =>
    auth.platform === 'student' && ['projects', 'knowledge', 'posts'].includes(props.resource.key),
);
const isStudentKnowledge = computed(() => studentCards.value && props.resource.key === 'knowledge');
const knowledgeTypes = computed(
  () => schema(listOp.value?.parameters.find((p) => p.name === 'contentType')?.schema).enum || [],
);
const rows = ref<Row[]>([]),
  total = ref(0),
  page = ref(1),
  size = ref(20),
  q = ref(''),
  status = ref(''),
  sort = ref('createdAt:desc'),
  loading = ref(false),
  listFailed = ref(false),
  error = ref(''),
  saving = ref(false),
  notice = ref('');
const editing = ref<Row | null>(null),
  formOpen = ref(false),
  form = ref<Record<string, unknown>>({}),
  writeKey = ref(''),
  detail = ref<Row | null>(null),
  remove = ref<Row | null>(null);
function updateField(key: string, value: unknown) {
  if (props.resource.key === 'contents' && key === 'type' && form.value.type !== value) {
    form.value.assetId = null;
    if (value !== 'MARKDOWN') form.value.markdown = '';
  }
  if (props.resource.key === 'contents' && key === 'audience' && value !== 'PROJECT')
    form.value.projectId = null;
  form.value[key] = value;
}
const detailFields = computed(() => {
  const excluded = ['id', 'version', 'requirementAssetIds'];
  if (['knowledge', 'contents'].includes(props.resource.key)) excluded.push('markdown');
  if (props.resource.key === 'projects' && auth.platform === 'partner') excluded.push('milestones');
  return Object.fromEntries(
    Object.entries(detail.value || {})
      .filter(([key]) => !excluded.includes(key))
      .sort(([a], [b]) => {
        const rank = (key: string) => {
          const index = props.resource.columns.indexOf(key);
          return index >= 0 ? index : ['createdAt', 'updatedAt'].includes(key) ? 1000 : 100;
        };
        return rank(a) - rank(b);
      }),
  );
});
const extraFilters = ref<Record<string, unknown>>({});
let loadGeneration = 0;
const knowledgeCounts = ref<Record<string, number | null>>({});
let countGeneration = 0;
async function loadKnowledgeCounts() {
  if (props.resource.key !== 'contents') return;
  const current = ++countGeneration;
  knowledgeCounts.value = {};
  await Promise.all(
    ['', 'DRAFT', 'REVIEW', 'PUBLISHED', 'WITHDRAWN'].map(async (state) => {
      try {
        const result = await request<Page<Row>>(props.resource.path, {
          query: { page: 1, size: 1, ...(state ? { status: state } : {}) },
        });
        if (current === countGeneration) knowledgeCounts.value[state] = result.total;
      } catch {
        if (current === countGeneration) knowledgeCounts.value[state] = null;
      }
    }),
  );
}
onMounted(loadKnowledgeCounts);
onBeforeUnmount(() => countGeneration++);
const listOp = computed(() => operation('GET', props.resource.path));
const queryNames = computed(
  () => new Set(listOp.value?.parameters.filter((p) => p.in === 'query').map((p) => p.name)),
);
const extraFields = computed(() =>
  (listOp.value?.parameters || [])
    .filter(
      (p) =>
        p.in === 'query' &&
        ![
          'page',
          'size',
          'q',
          'status',
          'sort',
          ...(isStudentKnowledge.value
            ? ['categoryId', 'contentType']
            : props.resource.key === 'posts' && studentCards.value
              ? ['boardId']
              : []),
        ].includes(p.name),
    )
    .map((p) => ({ key: p.name, ...schema(p.schema) })),
);
const statusOptions = computed(() => {
  const pageSchema = schema(listOp.value?.response);
  const rowSchema = schema(schema(pageSchema.properties?.items).items);
  return (
    schema(
      rowSchema.properties?.status || rowSchema.properties?.state || rowSchema.properties?.stage,
    ).enum || []
  );
});
const sorts = computed(
  () => (listOp.value?.parameters.find((p) => p.name === 'sort')?.schema.enum as string[]) || [],
);
function allowed(method: string, path: string) {
  const op = operation(method, path);
  return !!op && (!op.permission || auth.permissions.includes(op.permission));
}
const canCreate = computed(() => !props.resource.readonly && allowed('POST', props.resource.path));
const editMethod = computed(() => updateMethod(props.resource.path));
const canEdit = computed(
  () =>
    !props.resource.readonly &&
    !!editMethod.value &&
    allowed(editMethod.value, props.resource.path + '/{id}'),
);
const hasStatusAction = computed(() => !!operation('POST', props.resource.path + '/{id}/status'));
const canChangeStatus = computed(
  () => !props.resource.readonly && allowed('POST', props.resource.path + '/{id}/status'),
);
const statusBusy = ref(false);
const statusAttempt = writeAttempt();
async function toggleStatus(row: Row) {
  if (statusBusy.value || !canChangeStatus.value) return;
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
  const path = props.resource.path + '/' + row.id + '/status';
  const body = { status: next };
  statusBusy.value = true;
  error.value = '';
  try {
    await request(path, {
      method: 'POST',
      body,
      version: row.version,
      key: statusAttempt({ path, version: row.version, ...body }),
    });
    notice.value = next === 'ENABLED' ? '已启用' : '已停用';
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    statusBusy.value = false;
  }
}
const canDelete = computed(
  () => !props.resource.readonly && allowed('DELETE', props.resource.path + '/{id}'),
);
function rowActions(row: Row) {
  return auth.platform === 'student' && props.resource.key === 'posts'
    ? studentPostActions(row, auth.user?.id)
    : { edit: true, remove: true };
}
const fields = computed(() =>
  schema(
    operation(
      editing.value ? editMethod.value || 'PUT' : 'POST',
      props.resource.path + (editing.value ? '/{id}' : ''),
    )?.body,
  ),
);
const properties = computed(() =>
  Object.entries(fields.value.properties || {})
    .filter(
      ([key, v]) =>
        !v.readOnly &&
        !(key === 'orderNo' && props.resource.key === 'orders' && !editing.value) &&
        !(key === 'status' && hasStatusAction.value) &&
        !(key === 'schoolId' && props.resource.key === 'majors'),
    )
    .map(([key, value]) => ({ key, ...schema(value) }))
    .sort((a, b) => {
      if (props.resource.key !== 'posts') return 0;
      const order = ['title', 'boardId', 'tagIds', 'body', 'assetIds'];
      const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
      return rank(a.key) - rank(b.key);
    }),
);
async function load() {
  const generation = ++loadGeneration;
  loading.value = true;
  listFailed.value = false;
  // 查询条件或页码已改变，旧行不能继续冒充本次查询结果。
  rows.value = [];
  total.value = 0;
  error.value = '';
  try {
    const query: Record<string, unknown> = {};
    for (const [k, v] of Object.entries({
      ...extraFilters.value,
      page: page.value,
      size: size.value,
      q: q.value,
      status: status.value,
      sort: sort.value,
    }))
      if (queryNames.value.has(k) && v !== '' && v !== null && v !== undefined) {
        const field = extraFields.value.find((f) => f.key === k);
        query[k] = field?.format === 'date-time' ? new Date(String(v)).toISOString() : v;
      }
    const data = await request<Page<Row> | Row[]>(props.resource.path, {
      query,
    });
    if (generation !== loadGeneration) return;
    rows.value = Array.isArray(data) ? data : data.items;
    total.value = Array.isArray(data) ? data.length : data.total;
  } catch (e) {
    if (generation === loadGeneration) {
      listFailed.value = true;
      error.value = errorText(e);
    }
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function refreshUsage() {
  const runId = detail.value?.runId;
  await load();
  if (!runId || detail.value?.runId !== runId) return;
  const refreshed = rows.value.find((row) => row.runId === runId);
  if (refreshed) detail.value = refreshed;
}
function search() {
  page.value = 1;
  void load();
}
async function open(row?: Row) {
  const current = editRead.start();
  error.value = '';
  editing.value = row || null;
  form.value = {};
  if (row) {
    try {
      const loaded = allowed('GET', props.resource.path + '/{id}')
        ? await request<Row>(props.resource.path + '/' + row.id)
        : row;
      if (!current()) return;
      editing.value = loaded;
    } catch (e) {
      if (current()) error.value = errorText(e);
      return;
    }
  }
  for (const field of properties.value)
    form.value[field.key] =
      editing.value?.[field.key] ??
      field.default ??
      (field.type === 'boolean' ? false : field.type === 'array' ? [] : '');
  if (!row && props.resource.key === 'projects') {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    form.value.deliveryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (props.resource.key === 'majors') form.value.schoolId = editing.value?.schoolId ?? null;
  // 仅初始化新增草稿，输入、校验失败和重试均保留用户修改后的代码。
  if (
    !row &&
    ['categories', 'tags', 'material-categories', 'service-packages'].includes(props.resource.key)
  ) {
    const prefix =
      props.resource.key === 'categories'
        ? 'CAT'
        : props.resource.key === 'material-categories'
          ? 'MAT'
          : props.resource.key === 'service-packages'
            ? 'PKG'
            : 'TAG';
    form.value.code = `${prefix}_${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
  }
  if (hasStatusAction.value && fields.value.properties?.status)
    form.value.status = editing.value?.status ?? 'ENABLED';
  attempt = writeAttempt();
  writeKey.value = crypto.randomUUID();
  initialForm.value = JSON.stringify(form.value);
  formOpen.value = true;
  if (row && route.query.edit !== String(row.id))
    void router.push({ path: route.path, query: { ...listQuery(), edit: String(row.id) } });
}
let orderTitleGeneration = 0;
watch(
  () => form.value.orderId,
  async (id) => {
    const generation = ++orderTitleGeneration;
    if (!id || editing.value || props.resource.key !== 'projects') return;
    try {
      const order = await request<Row>(`/admin/orders/${id}`);
      if (generation === orderTitleGeneration && form.value.orderId === id)
        form.value.title = order.title;
    } catch (e) {
      if (generation === orderTitleGeneration) error.value = errorText(e);
    }
  },
);
async function save() {
  saving.value = true;
  error.value = '';
  try {
    const body = formBody(fields.value, form.value);
    await request(props.resource.path + (editing.value ? '/' + editing.value.id : ''), {
      method: editing.value ? editMethod.value : 'POST',
      body,
      version: editing.value?.version,
      key: attempt(body),
    });
    await closeForm();
    void loadKnowledgeCounts();
    notice.value =
      props.resource.key === 'contents' && !editing.value
        ? '草稿已保存，可在列表中提交审核。'
        : '数据已保存';
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    saving.value = false;
  }
}
type ProjectAction = 'milestones' | 'deliveries' | 'stage' | 'acceptance';
const projectAction = ref<{ record: Row; kind: ProjectAction } | null>(null);
const projectActionRead = latestRequest();
const projectActionTitles = {
  milestones: '里程碑管理',
  deliveries: '交付版本管理',
  stage: '推进项目阶段',
  acceptance: '提交项目验收',
};
function closeProjectAction() {
  projectActionRead.invalidate();
  projectAction.value = null;
}
async function openProjectAction(row: Row, kind: ProjectAction) {
  const current = projectActionRead.start();
  try {
    const record = await request<Row>(props.resource.path + '/' + row.id);
    if (current()) projectAction.value = { record, kind };
  } catch (e) {
    if (current()) error.value = errorText(e);
  }
}
async function projectActionChanged() {
  closeProjectAction();
  await load();
}
async function actionChanged(result: Row) {
  const current = detail.value;
  if (!current) return;
  // 举报等资源没有详情GET，直接使用同一资源的服务端新快照，避免显示旧状态/旧CAS版本。
  if (result?.id === current.id) detail.value = result;
  else await inspect(current);
  await load();
}
async function inspect(row: Row) {
  const current = detailRead.start();
  try {
    const loaded = allowed('GET', props.resource.path + '/{id}')
      ? await request<Row>(props.resource.path + '/' + row.id)
      : row;
    if (current()) {
      detail.value = loaded;
      if (!route.query.form && route.query.view !== String(row.id))
        void router.push({ path: route.path, query: { ...listQuery(), view: String(row.id) } });
    }
  } catch (e) {
    if (current()) error.value = errorText(e);
  }
}
async function destroy() {
  if (!remove.value) return;
  saving.value = true;
  try {
    await request(props.resource.path + '/' + remove.value.id, {
      method: 'DELETE',
      version: remove.value.version,
      key: writeKey.value,
    });
    remove.value = null;
    notice.value = '记录已删除';
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    saving.value = false;
  }
}
function askDelete(row: Row) {
  remove.value = row;
  writeKey.value = crypto.randomUUID();
}
onBeforeUnmount(() => {
  editRead.invalidate();
  projectActionRead.invalidate();
  detailRead.invalidate();
  loadGeneration++;
});
function applyRouteFilters() {
  q.value = typeof route.query.q === 'string' ? route.query.q : '';
  status.value =
    queryNames.value.has('status') && typeof route.query.status === 'string'
      ? route.query.status
      : '';
  extraFilters.value = {};
  for (const field of extraFields.value) {
    const value = route.query[field.key];
    if (value != null)
      extraFilters.value[field.key] =
        field.type === 'boolean'
          ? value === 'true'
          : field.type === 'array'
            ? Array.isArray(value)
              ? value
              : [value]
            : value;
  }
  sort.value = sorts.value.includes(String(route.query.sort))
    ? String(route.query.sort)
    : sorts.value[0] || '';
  page.value = positivePage(route.query.page);
  size.value = [10, 20, 50].includes(Number(route.query.size)) ? Number(route.query.size) : 20;
  void load();
}
onMounted(applyRouteFilters);
watch(
  () => route.params.action,
  (action, previous) => {
    if (previous === 'new' && action !== 'new') {
      closeProjectAction();
      closeDetail();
    }
  },
);
// 关联新增页刷新后按原资源权限重新读取父记录，不依赖列表缓存。
watch(
  () => [route.params.action, route.query.form, route.query.source],
  async () => {
    if (route.params.action !== 'new' || typeof route.query.source !== 'string') return;
    const kind = route.query.form;
    if (route.query.process && kind === 'delivery') return;
    if (props.resource.key === 'projects' && (kind === 'milestone' || kind === 'delivery'))
      await openProjectAction(
        { id: route.query.source },
        kind === 'milestone' ? 'milestones' : 'deliveries',
      );
    else if (['users', 'membership-plans'].includes(props.resource.key) && kind === 'membership')
      await inspect({ id: route.query.source });
  },
  { immediate: true },
);

watch(
  creatingPage,
  (active) => {
    if (active && canCreate.value) void open();
    else {
      editRead.invalidate();
      formOpen.value = false;
    }
  },
  { immediate: true },
);
watch(() => [route.query.q, route.query.status, route.query.state], applyRouteFilters);
watch(
  () => route.query.edit,
  async (id) => {
    if (typeof id !== 'string') {
      if (!creatingPage.value) formOpen.value = false;
      return;
    }
    if (formOpen.value && String(editing.value?.id) === id) return;
    if (allowed('GET', props.resource.path + '/{id}')) await open({ id });
    else {
      const row = rows.value.find((item) => String(item.id) === id);
      if (row) await open(row);
    }
  },
  { immediate: true },
);
watch(
  () => route.query.view,
  async (id) => {
    if (typeof id !== 'string') {
      detail.value = null;
      return;
    }
    if (detail.value?.id === id) return;
    if (allowed('GET', props.resource.path + '/{id}')) await inspect({ id });
    else {
      const existing = rows.value.find((row) => String(row.id) === id);
      if (existing) await inspect(existing);
      else error.value = '当前记录暂不可直接打开，请在列表中查找。';
    }
  },
  { immediate: true },
);
const hasStatusTabs = computed(
  () =>
    auth.platform !== 'student' &&
    ['orders', 'projects', 'users', 'posts', 'reports'].includes(props.resource.key) &&
    queryNames.value.has('status') &&
    statusOptions.value.length > 0,
);
</script>
<template>
  <Teleport to="body">
    <div v-if="discardOpen" class="modal-backdrop" style="z-index: 300">
      <section
        class="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        v-dialog="() => finishDiscard(false)"
      >
        <h2 id="discard-title">放弃未保存的修改？</h2>
        <p>离开后，本次修改不会保存。</p>
        <div class="actions">
          <button class="button" @click="finishDiscard(false)">继续编辑</button
          ><button class="button danger" @click="finishDiscard(true)">放弃修改并离开</button>
        </div>
      </section>
    </div>
  </Teleport>
  <WorkflowPage
    v-if="route.query.process && (route.params.action !== 'new' || route.query.form === 'delivery')"
    :resource="resource"
    @changed="
      load();
      loadKnowledgeCounts();
    "
  />
  <section :class="{ 'student-resource': studentCards, ['student-' + resource.key]: studentCards }">
    <section v-if="isStudentKnowledge" class="student-knowledge-hero">
      <div class="knowledge-hero-top">
        <div>
          <p class="eyebrow">基础知识库</p>
          <h1>先把问题找对，<br />答案会自己浮现。</h1>
          <p>从开题、开发到论文与答辩，查找当前可访问的项目资料。</p>
        </div>
        <div class="knowledge-result-count">
          <strong>{{ loading || listFailed ? '—' : total }}</strong
          ><span>当前筛选结果</span>
        </div>
      </div>
      <form class="knowledge-hero-search" @submit.prevent="search">
        <Icon name="search" /><input
          v-model="q"
          type="search"
          maxlength="100"
          aria-label="搜索知识库内容"
          placeholder="搜索开题报告、论文模板、答辩问题…"
        /><button class="button primary" :disabled="loading">搜索</button>
      </form>
      <div class="knowledge-quick-search">
        <span>快速查找</span
        ><button
          v-for="keyword in ['开题报告', '论文模板', '答辩', 'RAG', '任务书']"
          :key="keyword"
          :disabled="loading"
          @click="
            q = keyword;
            search();
          "
        >
          {{ keyword }}
        </button>
      </div>
    </section>
    <div v-else-if="!(detail && studentCards && resource.key === 'projects')" class="page-heading">
      <div>
        <p class="eyebrow">{{ studentCards ? resource.title : resource.group }}</p>
        <h1 v-if="studentCards && resource.key === 'knowledge'">
          先把问题找对，<br />答案会自己浮现。
        </h1>
        <h1 v-else-if="studentCards && resource.key === 'posts'">
          有人一起，<br />问题就没那么难。
        </h1>
        <h1 v-else>{{ resource.title }}</h1>
        <p class="muted">{{ resource.subtitle }}</p>
      </div>
      <button v-if="canCreate" class="button primary" @click="beginCreate">
        <Icon name="plus" />{{
          resource.key === 'posts' ? '发布帖子' : '新增' + resource.title.replace('管理', '')
        }}
      </button>
    </div>
    <nav
      v-if="resource.key === 'contents'"
      class="workflow-tabs"
      aria-label="知识内容状态（全部内容数量）"
    >
      <button
        v-for="tab in [
          { value: '', title: '全部内容' },
          { value: 'DRAFT', title: '草稿' },
          { value: 'REVIEW', title: '待审核' },
          { value: 'PUBLISHED', title: '已发布' },
          { value: 'WITHDRAWN', title: '已撤回' },
        ]"
        :key="tab.value"
        class="button"
        :class="{ primary: status === tab.value }"
        @click="
          status = tab.value;
          search();
        "
      >
        {{ tab.title }} <span class="tab-count">{{ knowledgeCounts[tab.value] ?? '—' }}</span>
      </button>
    </nav>
    <PartnerInvitation
      v-if="resource.key === 'users' && auth.platform === 'admin'"
      @changed="load"
    />
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div
      :class="{
        'student-knowledge-layout': studentCards && resource.key === 'knowledge',
        'student-forum-layout': studentCards && resource.key === 'posts',
      }"
    >
      <KnowledgeCategoryNav
        v-if="studentCards && resource.key === 'knowledge'"
        :model-value="extraFilters.categoryId"
        @update:model-value="
          extraFilters.categoryId = $event;
          search();
        "
      />
      <div v-if="!(detail && studentCards && resource.key === 'projects')" class="data-card">
        <div
          v-if="hasStatusTabs"
          class="resource-status-tabs"
          role="group"
          aria-label="列表状态筛选"
        >
          <button
            type="button"
            :class="{ active: !status }"
            :aria-pressed="!status"
            :disabled="loading"
            @click="
              status = '';
              search();
            "
          >
            全部</button
          ><button
            v-for="value in statusOptions"
            :key="String(value)"
            type="button"
            :class="{ active: status === value }"
            :aria-pressed="status === value"
            :disabled="loading"
            @click="
              status = String(value);
              search();
            "
          >
            {{ display(value) }}
          </button>
        </div>
        <div v-if="isStudentKnowledge" class="knowledge-type-toolbar" aria-label="知识内容类型">
          <button
            :class="{ active: !extraFilters.contentType }"
            :aria-pressed="!extraFilters.contentType"
            :disabled="loading"
            @click="
              extraFilters.contentType = '';
              search();
            "
          >
            全部内容</button
          ><button
            v-for="type in knowledgeTypes"
            :key="String(type)"
            :class="{ active: extraFilters.contentType === type }"
            :aria-pressed="extraFilters.contentType === type"
            :disabled="loading"
            @click="
              extraFilters.contentType = type;
              search();
            "
          >
            {{ type === 'MARKDOWN' ? 'Markdown' : display(type) }}
          </button>
          <AppSelect v-model="sort" aria-label="知识内容排序" @change="search">
            <option v-for="s in sorts" :key="s" :value="s">
              {{
                s === 'createdAt:asc'
                  ? '创建时间从早到晚'
                  : s === 'updatedAt:desc'
                    ? '最近更新优先'
                    : '最近创建优先'
              }}
            </option>
          </AppSelect>
          <button
            class="knowledge-reset"
            :disabled="loading"
            @click="
              q = '';
              status = '';
              extraFilters = {};
              sort = sorts[0] || '';
              search();
            "
          >
            重置筛选
          </button>
        </div>
        <details v-if="isStudentKnowledge && extraFields.length" class="knowledge-extra-filters">
          <summary>按标签进一步筛选</summary>
          <form @submit.prevent="search">
            <label v-for="field in extraFields" :key="field.key"
              >{{ label(field.key)
              }}<SchemaField
                v-model="extraFilters[field.key]"
                :field="field"
                :context="resource.key" /></label
            ><button class="button" :disabled="loading">应用筛选</button>
          </form>
        </details>
        <form v-if="!isStudentKnowledge" class="filters" @submit.prevent="search">
          <input
            v-if="queryNames.has('q')"
            v-model="q"
            placeholder="输入关键词搜索"
            aria-label="搜索关键词"
            maxlength="100"
          /><AppSelect
            v-if="queryNames.has('status') && !hasStatusTabs && resource.key !== 'contents'"
            v-model="status"
            aria-label="筛选状态"
          >
            <option value="">全部状态</option>
            <option v-for="value in statusOptions" :key="String(value)" :value="value">
              {{ display(value) }}
            </option></AppSelect
          ><AppSelect v-if="sorts.length" v-model="sort" aria-label="排序">
            <option v-for="s in sorts" :key="s" :value="s">
              {{
                s === 'createdAt:asc'
                  ? '创建时间从早到晚'
                  : s === 'updatedAt:desc'
                    ? '最近更新优先'
                    : '最近创建优先'
              }}
            </option>
          </AppSelect>
          <div class="filter-actions">
            <button class="button primary" :disabled="loading">查询</button
            ><button
              type="button"
              class="button"
              :disabled="loading"
              @click="
                q = '';
                status = '';
                extraFilters = {};
                sort = sorts[0] || '';
                search();
              "
            >
              重置
            </button>
          </div>
          <details v-if="extraFields.length" class="advanced-filters">
            <summary>更多筛选条件</summary>
            <div class="form-grid">
              <label v-for="field in extraFields" :key="field.key">
                {{ label(field.key) }}
                <SchemaField
                  v-model="extraFilters[field.key]"
                  :field="field"
                  :context="resource.key"
                  :filter="auth.platform === 'admin'"
                  :filters="field.key === 'majorId' ? { schoolId: extraFilters.schoolId } : {}"
                />
              </label>
            </div>
          </details>
        </form>
        <div
          v-if="
            Object.values(extraFilters).some(
              (value) => value !== '' && value != null && (!Array.isArray(value) || value.length),
            )
          "
          class="active-filter-tags"
          aria-label="已选筛选条件"
        >
          <template v-for="(value, key) in extraFilters" :key="key">
            <button
              v-if="value !== '' && value != null && (!Array.isArray(value) || value.length)"
              class="button"
              type="button"
              @click="
                delete extraFilters[key];
                search();
              "
            >
              {{ label(String(key)) }}：<ReferenceName :field="String(key)" :value="value" />
              <Icon name="close" />
            </button>
          </template>
        </div>
        <div v-if="studentCards" class="student-resource-grid" :aria-busy="loading">
          <article
            v-for="(row, index) in rows"
            :key="row.id || index"
            class="student-resource-card"
          >
            <div v-if="resource.key === 'posts'" class="forum-author-avatar" aria-hidden="true">
              {{ row.authorId === auth.user?.id ? '我' : '问' }}
            </div>
            <div
              v-if="resource.key === 'knowledge'"
              class="student-knowledge-cover"
              :class="`cover-${index % 3}`"
            >
              <AssetCover
                v-if="row.coverAssetId"
                :asset-id="row.coverAssetId"
                :alt="String(row.title)"
              /><span v-else
                ><Icon :name="row.type === 'VIDEO' ? 'right' : 'book'" />{{
                  display(row.type)
                }}</span
              ><b v-if="!row.coverAssetId">{{
                String((page - 1) * size + index + 1).padStart(2, '0')
              }}</b>
            </div>
            <div class="student-resource-card-body">
              <div class="student-resource-meta">
                <Icon :name="resource.icon" /><StatusBadge
                  v-if="row.stage || row.state"
                  :value="String(row.stage || row.state)"
                /><span v-else>知识资料</span>
              </div>
              <h2>
                <button @click="inspect(row)">{{ display(row.title) }}</button>
              </h2>
              <p v-if="resource.key === 'posts'" class="forum-excerpt">{{ row.body }}</p>
              <p v-else-if="row.description || row.summary">{{ row.description || row.summary }}</p>
              <div v-if="resource.key === 'projects'" class="student-project-progress">
                <span>项目阶段进度 {{ row.progress }}%</span
                ><progress
                  :value="Number(row.progress) || 0"
                  max="100"
                  aria-label="完成进度"
                ></progress
                ><small>计划交付 {{ display(row.deliveryDate) }}</small>
              </div>
              <div class="student-resource-meta">
                <ReferenceName
                  v-if="row.categoryId"
                  field="categoryId"
                  :value="row.categoryId"
                /><ReferenceName v-if="row.boardId" field="boardId" :value="row.boardId" /><span
                  v-if="row.updatedAt || row.createdAt"
                  >{{ display(row.updatedAt || row.createdAt) }}</span
                >
              </div>
              <div class="student-resource-actions">
                <button class="text-button" @click="inspect(row)">
                  {{
                    resource.key === 'projects'
                      ? '查看项目与交付'
                      : resource.key === 'knowledge'
                        ? '阅读资料'
                        : '查看讨论'
                  }}
                  <Icon name="right" /></button
                ><button
                  v-if="canEdit && rowActions(row).edit"
                  class="text-button"
                  @click="open(row)"
                >
                  编辑</button
                ><button
                  v-if="canDelete && rowActions(row).remove"
                  class="text-button danger"
                  @click="askDelete(row)"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
          <p v-if="!rows.length" class="empty">
            {{
              loading ? '正在读取数据…' : listFailed ? '读取失败，请重新查询' : '暂无符合条件的数据'
            }}
          </p>
        </div>
        <div v-else class="table-scroll" :aria-busy="loading">
          <table>
            <thead>
              <tr>
                <th v-for="column in resource.columns" :key="column">
                  {{ label(column) }}
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in rows" :key="row.id || index">
                <td v-for="column in resource.columns" :key="column">
                  <StatusBadge
                    v-if="['state', 'status', 'stage'].includes(column)"
                    :value="String(row[column] || '')"
                  /><ReferenceName
                    v-else-if="column.endsWith('Id')"
                    :field="column"
                    :value="row[column]"
                  /><span v-else-if="column === 'progress'" class="table-project-progress"
                    ><progress
                      :value="Number(row[column]) || 0"
                      max="100"
                      aria-label="完成进度"
                    ></progress
                    >{{ row[column] }}%</span
                  ><template v-else>{{ display(row[column]) }}</template>
                </td>
                <td class="actions">
                  <button
                    v-if="canChangeStatus && ['ENABLED', 'DISABLED'].includes(String(row.status))"
                    class="text-button"
                    :disabled="statusBusy"
                    @click="toggleStatus(row)"
                  >
                    {{ statusBusy ? '处理中…' : row.status === 'ENABLED' ? '停用' : '启用' }}
                  </button>

                  <button
                    v-for="(action, actionIndex) in recordActions(resource.key, row)"
                    :key="action.path"
                    class="text-button"
                    :class="{
                      'row-primary-action': actionIndex === 0,
                      'row-maintenance-action': action.path.endsWith('/reindex'),
                    }"
                    @click="
                      router.push({
                        path: route.path,
                        query: {
                          ...listQuery(),
                          process: String(row.id),
                          operation: action.path.split('/').pop(),
                        },
                      })
                    "
                  >
                    {{ action.title }}
                  </button>
                  <button class="text-button" @click="inspect(row)">查看</button
                  ><button
                    v-if="canEdit && rowActions(row).edit"
                    class="text-button"
                    @click="open(row)"
                  >
                    编辑</button
                  ><button
                    v-if="canDelete && rowActions(row).remove"
                    class="text-button danger"
                    @click="askDelete(row)"
                  >
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td :colspan="resource.columns.length + 1" class="empty">
                  {{
                    loading
                      ? '正在读取数据…'
                      : listFailed
                        ? '读取失败，请重新查询'
                        : '暂无符合条件的数据'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span>{{ loading ? '正在查询…' : listFailed ? '总数暂不可用' : `共 ${total} 条` }}</span
          ><AppSelect v-model.number="size" aria-label="每页条数" @change="search">
            <option :value="10">每页10条</option>
            <option :value="20">每页20条</option>
            <option :value="50">每页50条</option></AppSelect
          ><button
            class="button"
            :disabled="page === 1 || loading"
            @click="
              page--;
              load();
            "
          >
            上一页</button
          ><span>第 {{ page }} / {{ Math.max(1, Math.ceil(total / size)) }} 页</span
          ><button
            class="button"
            :disabled="page * size >= total || loading"
            @click="
              page++;
              load();
            "
          >
            下一页
          </button>
          <form class="page-jump" @submit.prevent="jump">
            <input
              v-model.number="jumpPage"
              type="number"
              min="1"
              :max="Math.max(1, Math.ceil(total / size))"
              aria-label="跳转页码"
            />
            <button class="button" :disabled="loading || listFailed">跳转</button>
          </form>
        </div>
      </div>
      <ForumSidebar
        v-if="studentCards && resource.key === 'posts'"
        :model-value="extraFilters.boardId"
        @update:model-value="
          extraFilters.boardId = $event;
          search();
        "
      />
    </div>
    <component
      :is="CreatePage"
      v-if="formOpen"
      :class="undefined"
      :title="(editing ? '编辑' : '新增') + resource.title.replace('管理', '')"
      :description="resource.subtitle"
      :busy="saving"
      @back="closeForm"
    >
      <form class="create-resource-form" aria-labelledby="form-title" @submit.prevent="save">
        <div class="resource-modal-heading">
          <h2 id="form-title">
            {{
              resource.key === 'posts'
                ? editing
                  ? '编辑帖子'
                  : '发布帖子'
                : (editing ? '编辑' : '新增') + resource.title.replace('管理', '')
            }}
          </h2>
          <button
            type="button"
            class="modal-close"
            aria-label="关闭编辑弹窗"
            :disabled="saving"
            @click="closeForm"
          >
            <Icon name="close" />
          </button>
        </div>
        <div class="resource-form-body">
          <div class="create-section-heading">
            <h2>{{ resource.key === 'contents' ? '内容资料与可见范围' : '基本信息' }}</h2>
            <p class="muted">
              标有 * 的字段为必填项。{{
                resource.key === 'contents' && !editing ? '保存后为草稿，可返回列表提交审核。' : ''
              }}
            </p>
          </div>
          <div class="form-grid">
            <div
              v-for="field in properties"
              v-show="resource.key !== 'contents' || knowledgeFieldVisible(field.key, form)"
              :key="field.key"
              class="form-field"
              :class="{
                wide:
                  ['assetIds', 'assetId', 'coverAssetId'].includes(field.key) ||
                  (resource.key === 'posts' && field.key === 'title') ||
                  (!!field.maxLength &&
                    field.maxLength > 500 &&
                    field.format !== 'uri' &&
                    !field.writeOnly),
              }"
            >
              <span class="field-caption"
                >{{ label(field.key)
                }}<span
                  v-if="requiresSelection(field, fields.required?.includes(field.key))"
                  class="danger"
                  aria-hidden="true"
                >
                  *</span
                ></span
              >
              <SchemaField
                :model-value="form[field.key]"
                @update:model-value="updateField(field.key, $event)"
                :field="field"
                :required="fields.required?.includes(field.key)"
                :context="resource.key"
                :filters="
                  field.key === 'majorId' ? { schoolId: form.schoolId } : { contentType: form.type }
                "
              />
              <small
                v-if="
                  !editing &&
                  field.key === 'code' &&
                  ['categories', 'tags', 'material-categories', 'service-packages'].includes(
                    resource.key,
                  )
                "
                class="muted"
                >已自动生成，可按需修改；业务代码须保持唯一。</small
              >
            </div>
          </div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </div>
        <footer class="resource-form-footer">
          <button type="button" class="button" :disabled="saving" @click="closeForm">取消</button
          ><button class="button primary" :disabled="saving">
            {{
              saving
                ? '保存中…'
                : resource.key === 'contents' && !editing
                  ? '保存草稿'
                  : editing
                    ? '保存修改'
                    : '保存'
            }}
          </button>
        </footer>
      </form>
    </component>
    <StudentProjectSpace
      v-if="detail && studentCards && resource.key === 'projects'"
      :key="String(detail.id)"
      :project="detail"
      @back="closeDetail"
      @changed="actionChanged"
      @refresh="
        inspect(detail);
        load();
      "
    />
    <StudentReadingDialog
      v-else-if="detail && studentCards && ['knowledge', 'posts'].includes(resource.key)"
      :key="String(detail.id)"
      :content="detail"
      :kind="resource.key === 'posts' ? 'forum' : 'knowledge'"
      @changed="
        inspect(detail);
        load();
      "
      @close="closeDetail"
    />
    <CreatePage
      v-else-if="detail"
      :title="String(detail.title || detail.name || resource.title)"
      description="记录详情"
      @back="closeDetail"
    >
      <section class="resource-detail-page" aria-label="记录详情">
        <div class="resource-modal-heading">
          <h2>{{ resource.title }}详情</h2>
          <button class="modal-close" aria-label="关闭记录详情" @click="closeDetail">
            <Icon name="close" />
          </button>
        </div>
        <div class="resource-detail-body">
          <p v-if="detail.evidenceSource === 'CORRECTED_ORIGINAL_CALL'" class="notice">
            已按迟到原调用证据更正。原始用量和预占状态保留，当前计费以有效词元和净费用为准。
          </p>
          <dl class="detail-grid">
            <div
              v-for="(value, key) in detailFields"
              :key="key"
              class="resource-detail-item"
              :class="{ wide: ['body', 'description', 'remark', 'reason'].includes(String(key)) }"
            >
              <dt>{{ label(key) }}</dt>
              <dd>
                <StatusBadge
                  v-if="['status', 'state', 'stage', 'receiptStatus'].includes(String(key))"
                  :value="value"
                />
                <ReferenceName v-else :field="String(key)" :value="value" />
              </dd>
            </div>
          </dl>

          <RequirementAttachments
            v-if="resource.key === 'projects'"
            :ids="detail.requirementAssetIds"
          />
          <PartnerStudentOrders
            v-if="auth.platform === 'partner' && resource.key === 'students'"
            :student-id="String(detail.id)"
          />
          <PartnerStudentOrders
            kind="projects"
            v-if="auth.platform === 'partner' && resource.key === 'students'"
            :student-id="String(detail.id)"
          />
          <InvitationDetail
            v-if="auth.platform === 'admin' && resource.key === 'users'"
            :user="detail"
          />
          <UsageDetail
            v-if="resource.key === 'usage'"
            :usage="detail"
            @changed="refreshUsage"
          /><OrderDetail
            v-if="resource.key === 'orders'"
            :order="detail"
            mode="readonly"
            @changed="
              inspect(detail);
              load();
            "
          /><KnowledgeDetail
            v-if="['contents', 'knowledge'].includes(resource.key)"
            :content="detail"
            @changed="
              inspect(detail);
              load();
            "
          /><MembershipDetail
            v-if="
              auth.platform === 'admin' &&
              (resource.key === 'membership-plans' ||
                (resource.key === 'users' && detail.platform === 'student'))
            "
            :key="'membership-' + detail.id"
            :record="detail"
            :mode="resource.key === 'users' ? 'user' : 'plan'"
            @changed="
              inspect(detail);
              load();
            "
          /><ForumDetail
            v-if="resource.key === 'posts'"
            :post="detail"
            @changed="
              inspect(detail);
              load();
            "
          />
        </div>
        <footer class="resource-detail-footer">
          <button class="button" @click="closeDetail">关闭</button>
        </footer>
      </section>
    </CreatePage>
    <div v-if="projectAction" class="modal-backdrop">
      <section
        class="modal resource-detail-modal"
        v-dialog="closeProjectAction"
        role="dialog"
        aria-modal="true"
        :aria-label="projectActionTitles[projectAction.kind]"
      >
        <div class="resource-modal-heading">
          <h2>{{ projectActionTitles[projectAction.kind] }}</h2>
          <button class="modal-close" aria-label="关闭项目操作" @click="closeProjectAction">
            <Icon name="close" />
          </button>
        </div>
        <div class="resource-detail-body">
          <p>{{ projectAction.record.title }}</p>
          <ProjectDetail
            v-if="projectAction.kind === 'milestones' || projectAction.kind === 'deliveries'"
            :key="String(projectAction.record.id) + projectAction.kind"
            :project="projectAction.record"
            :section="projectAction.kind"
            @changed="load()"
          />
          <RecordActions
            v-else
            :key="String(projectAction.record.id) + projectAction.kind"
            resource-key="projects"
            :record="projectAction.record"
            :action-path="'/admin/projects/{id}/' + projectAction.kind"
            @changed="projectActionChanged"
            @cancel="closeProjectAction"
          />
        </div>
        <footer class="resource-detail-footer">
          <button class="button" @click="closeProjectAction">关闭</button>
        </footer>
      </section>
    </div>
    <div v-if="remove" class="modal-backdrop">
      <section
        class="modal"
        v-dialog="
          () => {
            if (!saving) remove = null;
          }
        "
        role="alertdialog"
        aria-modal="true"
        aria-label="确认删除"
      >
        <h2>确认删除记录？</h2>
        <p>被其他业务引用的记录将受到删除保护。请核对后继续。</p>
        <p>{{ display(remove.name || remove.title || remove.code) }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <footer>
          <button class="button" :disabled="saving" @click="remove = null">取消</button
          ><button class="button primary" :disabled="saving" @click="destroy">确认删除</button>
        </footer>
      </section>
    </div>
  </section>
</template>
<style scoped>
.advanced-filters {
  flex-basis: 100%;
  width: 100%;
}
.advanced-filters summary {
  cursor: pointer;
  margin: 8px 0;
}

.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.data-card {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 14px;
  overflow: visible;
}
.filters {
  display: flex;
  gap: 12px;
  padding: 20px;
  flex-wrap: wrap;
}
.filters > input {
  min-width: 180px;
}
.table-scroll {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
th {
  background: #f8f9fc;
  color: #64748b;
  font-weight: 500;
  padding: 15px 18px;
  white-space: nowrap;
}
td {
  padding: 18px;
  border-top: 1px solid #edf0f5;
  max-width: 300px;
  overflow-wrap: anywhere;
}
.actions {
  white-space: nowrap;
}
.text-button {
  border: 0;
  background: none;
  color: #2c4bdb;
  cursor: pointer;
  padding: 4px 8px;
}
.danger {
  color: #c93648;
}
.empty {
  text-align: center;
  padding: 60px;
  color: #718096;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  padding: 20px;
  font-size: 13px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: #13214380;
  display: grid;
  place-items: center;
  z-index: 100;
  grid-template-columns: minmax(0, 1fr);
  padding: 24px;
}
.modal {
  background: white;
  border-radius: 16px;
  padding: 28px;
  max-height: 90vh;
  overflow: auto;
  width: min(720px, 100%);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.form-grid .form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.modal footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 28px;
}
.resource-detail-modal,
.resource-form-modal {
  width: min(880px, 100%);
  padding: 0;
  overflow: hidden;
  max-height: calc(100dvh - 48px);
}
.resource-form-modal {
  width: min(760px, 100%);
}
.resource-detail-modal > .resource-modal-heading,
.resource-form-modal > .resource-modal-heading {
  flex-shrink: 0;
  margin: 0;
  padding: 22px 28px;
  border-bottom: 1px solid #e8ecf4;
}
.resource-detail-body,
.resource-form-body {
  padding: 8px 28px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.resource-form-body {
  padding-top: 24px;
}
.resource-detail-modal > .resource-detail-footer,
.resource-form-modal > .resource-form-footer {
  flex-shrink: 0;
  padding: 16px 28px;
  margin: 0;
  border-top: 1px solid #e8ecf4;
  background: #fcfdff;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 28px;
  padding: 0;
  margin: 0 0 24px;
}
.resource-detail-item {
  padding: 16px 0;
  border-bottom: 1px solid #edf0f5;
  min-width: 0;
  font-size: 14px;
}
.resource-detail-item.wide {
  grid-column: 1 / -1;
}
.detail-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-grid dt {
  color: #8591a4;
  font-size: 12px;
  margin-bottom: 8px;
}
.notice {
  color: #148357;
}
@media (max-width: 650px) {
  .resource-detail-body {
    padding: 4px 18px 20px;
  }
  .resource-detail-modal > .resource-modal-heading,
  .resource-detail-modal > .resource-detail-footer {
    padding: 16px 18px;
  }
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style scoped>
.workflow-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
</style>

<style scoped>
.active-filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 14px;
}
.active-filter-tags .button {
  min-height: 32px;
  font-size: 12px;
}
.resource-detail-page .resource-modal-heading,
.resource-detail-page .resource-detail-footer {
  display: none;
}
.resource-detail-page .resource-detail-body {
  overflow: visible;
  max-height: none;
  padding: 0;
}
</style>

<style scoped>
.page-jump {
  display: flex;
  gap: 8px;
  align-items: center;
}
.page-jump input {
  width: 72px;
  min-width: 0;
}
</style>

<style scoped>
.actions {
  min-width: 250px;
  max-width: 340px;
}
.actions .text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 4px 9px;
  margin: 3px 2px;
  border: 1px solid #e3eaf3;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  color: #496582;
}
.actions .text-button:hover {
  background: #eef6ff;
  border-color: #c5dcf4;
}
.actions .text-button.row-primary-action {
  background: #eaf4ff;
  color: #2766a5;
  border-color: #d4e6f9;
}
.actions .text-button.danger {
  color: #b94d4d;
}
</style>
