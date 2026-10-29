<script setup lang="ts">
import { latestRequest } from '../api/latest';
import { writeAttempt } from '../api/attempt';
import { computed, onMounted, onBeforeUnmount, ref, defineAsyncComponent } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation, schema, updateMethod } from '../config/contract';
import { label, display } from '../config/labels';
import type { Resource } from '../config/resources';
import type { Row, Page } from '../types/api';
const InvitationDetail = defineAsyncComponent(() => import('../components/InvitationDetail.vue'));
const UsageDetail = defineAsyncComponent(() => import('../components/UsageDetail.vue'));
const OrderDetail = defineAsyncComponent(() => import('../components/OrderDetail.vue'));
const KnowledgeDetail = defineAsyncComponent(() => import('../components/KnowledgeDetail.vue'));
const PartnerInvitation = defineAsyncComponent(() => import('../components/PartnerInvitation.vue'));
const MembershipDetail = defineAsyncComponent(() => import('../components/MembershipDetail.vue'));
import ReferenceName from '../components/ReferenceName.vue';
const ForumDetail = defineAsyncComponent(() => import('../components/ForumDetail.vue'));
import RecordActions from '../components/RecordActions.vue';
const ProjectDetail = defineAsyncComponent(() => import('../components/ProjectDetail.vue'));
import StatusBadge from '../components/StatusBadge.vue';
import Icon from '../components/Icon.vue';
import KnowledgeCategoryNav from '../components/KnowledgeCategoryNav.vue';
import { formBody, requiresSelection } from '../config/form';
import SchemaField from '../components/SchemaField.vue';
let attempt = writeAttempt();
const editRead = latestRequest(),
  detailRead = latestRequest();
function closeForm() {
  editRead.invalidate();
  formOpen.value = false;
}
function closeDetail() {
  detailRead.invalidate();
  detail.value = null;
}
const props = defineProps<{ resource: Resource }>();
const studentCards = computed(
  () =>
    auth.platform === 'student' && ['projects', 'knowledge', 'posts'].includes(props.resource.key),
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
const detailFields = computed(() => {
  const excluded = ['id', 'version'];
  if (props.resource.key === 'projects' && auth.platform === 'partner') excluded.push('milestones');
  return Object.fromEntries(
    Object.entries(detail.value || {}).filter(([key]) => !excluded.includes(key)),
  );
});
const extraFilters = ref<Record<string, unknown>>({});
let loadGeneration = 0;
const listOp = computed(() => operation('GET', props.resource.path));
const queryNames = computed(
  () => new Set(listOp.value?.parameters.filter((p) => p.in === 'query').map((p) => p.name)),
);
const extraFields = computed(() =>
  (listOp.value?.parameters || [])
    .filter((p) => p.in === 'query' && !['page', 'size', 'q', 'status', 'sort'].includes(p.name))
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
const canDelete = computed(
  () => !props.resource.readonly && allowed('DELETE', props.resource.path + '/{id}'),
);
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
    .filter(([, v]) => !v.readOnly)
    .map(([key, value]) => ({ key, ...schema(value) })),
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
  attempt = writeAttempt();
  writeKey.value = crypto.randomUUID();
  formOpen.value = true;
}
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
    formOpen.value = false;
    notice.value = '数据已保存';
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    saving.value = false;
  }
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
    if (current()) detail.value = loaded;
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
  detailRead.invalidate();
  loadGeneration++;
});
onMounted(() => {
  sort.value = sorts.value[0] || '';
  void load();
});
</script>
<template>
  <section :class="{ 'student-resource': studentCards, ['student-' + resource.key]: studentCards }">
    <div v-if="!(detail && studentCards && resource.key === 'projects')" class="page-heading">
      <div>
        <p v-if="studentCards" class="eyebrow">{{ resource.title }}</p>
        <h1 v-if="studentCards && resource.key === 'knowledge'">
          先把问题找对，<br />答案会自己浮现。
        </h1>
        <h1 v-else-if="studentCards && resource.key === 'posts'">
          有人一起，<br />问题就没那么难。
        </h1>
        <h1 v-else>{{ resource.title }}</h1>
        <p class="muted">{{ resource.subtitle }}</p>
      </div>
      <button v-if="canCreate" class="button primary" @click="open()">
        {{ resource.key === 'posts' ? '发布帖子' : '新增' + resource.title.replace('管理', '') }}
      </button>
    </div>
    <PartnerInvitation
      v-if="resource.key === 'users' && auth.platform === 'admin'"
      @changed="load"
    />
    <p v-if="notice" role="status" class="notice">{{ notice }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div :class="{ 'student-knowledge-layout': studentCards && resource.key === 'knowledge' }">
      <KnowledgeCategoryNav
        v-if="studentCards && resource.key === 'knowledge'"
        :model-value="extraFilters.categoryId"
        @update:model-value="
          extraFilters.categoryId = $event;
          search();
        "
      />
      <div v-if="!(detail && studentCards && resource.key === 'projects')" class="data-card">
        <form class="filters" @submit.prevent="search">
          <input
            v-if="queryNames.has('q')"
            v-model="q"
            placeholder="输入关键词搜索"
            aria-label="搜索关键词"
            maxlength="100"
          /><select v-if="queryNames.has('status')" v-model="status" aria-label="筛选状态">
            <option value="">全部状态</option>
            <option v-for="value in statusOptions" :key="String(value)" :value="value">
              {{ display(value) }}
            </option></select
          ><select v-if="sorts.length" v-model="sort" aria-label="排序">
            <option v-for="s in sorts" :key="s" :value="s">
              {{
                s === 'createdAt:asc'
                  ? '创建时间从早到晚'
                  : s === 'updatedAt:desc'
                    ? '最近更新优先'
                    : '最近创建优先'
              }}
            </option></select
          ><button class="button primary" :disabled="loading">查询</button
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
          <details v-if="extraFields.length" class="advanced-filters">
            <summary>更多筛选条件</summary>
            <div class="form-grid">
              <label v-for="field in extraFields" :key="field.key">
                {{ label(field.key) }}
                <SchemaField
                  v-model="extraFilters[field.key]"
                  :field="field"
                  :context="resource.key"
                  :filters="field.key === 'majorId' ? { schoolId: extraFilters.schoolId } : {}"
                />
              </label>
            </div>
          </details>
        </form>
        <div v-if="studentCards" class="student-resource-grid" :aria-busy="loading">
          <article
            v-for="(row, index) in rows"
            :key="row.id || index"
            class="student-resource-card"
          >
            <div
              v-if="resource.key === 'knowledge'"
              class="student-knowledge-cover"
              :class="`cover-${index % 3}`"
            >
              <span
                ><Icon :name="row.type === 'VIDEO' ? 'video' : 'book'" />{{
                  display(row.type)
                }}</span
              ><b>{{ String((page - 1) * size + index + 1).padStart(2, '0') }}</b>
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
              <p v-if="row.description || row.summary">{{ row.description || row.summary }}</p>
              <div v-if="resource.key === 'projects'" class="student-project-progress">
                <span>项目完成度 {{ row.progress }}%</span
                ><progress
                  :value="Number(row.progress) || 0"
                  max="100"
                  aria-label="项目完成度"
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
                ><button v-if="canEdit" class="text-button" @click="open(row)">编辑</button
                ><button v-if="canDelete" class="text-button danger" @click="askDelete(row)">
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
                  /><template v-else>{{ display(row[column]) }}</template>
                </td>
                <td class="actions">
                  <button class="text-button" @click="inspect(row)">查看</button
                  ><button v-if="canEdit" class="text-button" @click="open(row)">编辑</button
                  ><button v-if="canDelete" class="text-button danger" @click="askDelete(row)">
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
          ><select v-model.number="size" aria-label="每页条数" @change="search">
            <option :value="10">每页10条</option>
            <option :value="20">每页20条</option>
            <option :value="50">每页50条</option></select
          ><button
            class="button"
            :disabled="page === 1 || loading"
            @click="
              page--;
              load();
            "
          >
            上一页</button
          ><span>第 {{ page }} 页</span
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
        </div>
      </div>
    </div>
    <div v-if="formOpen" class="modal-backdrop">
      <form
        class="modal"
        v-dialog="
          () => {
            if (!saving) closeForm();
          }
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        @submit.prevent="save"
      >
        <h2 id="form-title">
          {{
            resource.key === 'posts'
              ? editing
                ? '编辑帖子'
                : '发布帖子'
              : (editing ? '编辑' : '新增') + resource.title
          }}
        </h2>
        <div class="form-grid">
          <div v-for="field in properties" :key="field.key" class="form-field">
            <span>{{ label(field.key) }}</span
            ><span
              v-if="requiresSelection(field, fields.required?.includes(field.key))"
              class="danger"
            >
              *</span
            ><SchemaField
              v-model="form[field.key]"
              :field="field"
              :required="fields.required?.includes(field.key)"
              :context="resource.key"
              :filters="field.key === 'majorId' ? { schoolId: form.schoolId } : {}"
            />
          </div>
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" class="button" :disabled="saving" @click="closeForm">取消</button
          ><button class="button primary" :disabled="saving">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </footer>
      </form>
    </div>
    <section
      v-if="detail && studentCards && resource.key === 'projects'"
      class="student-project-space"
    >
      <button class="text-button" @click="closeDetail">我的项目 / 返回项目列表</button>
      <header>
        <div>
          <p class="eyebrow">项目空间</p>
          <h1>{{ detail.title }}</h1>
          <p class="muted">
            计划交付 {{ display(detail.deliveryDate) }} · 最近更新 {{ display(detail.updatedAt) }}
          </p>
        </div>
        <RouterLink to="/student/chat" class="button primary"
          ><Icon name="sparkles" />智能答疑</RouterLink
        >
      </header>
      <div class="student-project-stage">
        <strong>{{ detail.progress }}%</strong><span>项目完成度</span
        ><StatusBadge :value="String(detail.stage)" /><progress
          :value="Number(detail.progress) || 0"
          max="100"
          aria-label="项目完成度"
        ></progress>
      </div>
      <ProjectDetail
        :project="detail"
        @changed="
          inspect(detail);
          load();
        "
      />
    </section>
    <div v-else-if="detail" class="modal-backdrop">
      <section
        class="modal"
        v-dialog="closeDetail"
        role="dialog"
        aria-modal="true"
        aria-label="记录详情"
      >
        <h2>{{ resource.title }}详情</h2>
        <p v-if="detail.evidenceSource === 'CORRECTED_ORIGINAL_CALL'" class="notice">
          已按迟到原调用证据更正。原始用量和预占状态保留，当前计费以有效词元和净费用为准。
        </p>
        <dl class="detail-grid">
          <template v-for="(value, key) in detailFields" :key="key"
            ><dt>{{ label(key) }}</dt>
            <dd><ReferenceName :field="key" :value="value" /></dd
          ></template>
        </dl>
        <section v-if="resource.key === 'projects' && auth.platform === 'partner'">
          <h3>项目里程碑</h3>
          <p v-if="!Array.isArray(detail.milestones) || !detail.milestones.length" class="muted">
            暂无里程碑
          </p>
          <article
            v-for="milestone in (detail.milestones as Row[]) || []"
            :key="String(milestone.id)"
            class="card"
          >
            <h4>{{ milestone.name }}</h4>
            <p>
              计划日期：{{ display(milestone.dueDate) }} · 权重：{{ milestone.weight }}% ·
              {{ milestone.completed ? '已完成' : '未完成' }}
            </p>
          </article>
        </section>
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
        /><RecordActions
          :resource-key="resource.key"
          :record="detail"
          @changed="actionChanged"
        /><ProjectDetail
          v-if="resource.key === 'projects' && auth.platform !== 'partner'"
          :project="detail"
          @changed="
            inspect(detail);
            load();
          "
        />
        <footer>
          <button class="button" @click="closeDetail">关闭</button>
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
  overflow: hidden;
}
.filters {
  display: flex;
  gap: 12px;
  padding: 20px;
  flex-wrap: wrap;
}
.filters input {
  min-width: 220px;
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
  z-index: 10;
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
.detail-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
}
.detail-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-grid dt {
  color: #718096;
}
.notice {
  color: #148357;
}
@media (max-width: 650px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
