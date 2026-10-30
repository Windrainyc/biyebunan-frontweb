<script setup lang="ts">
import AppSelect from './AppSelect.vue';
import { computed, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { operation, schema } from '../config/contract';
import { jobRecovery } from '../config/job-recovery';
import { formBody } from '../config/form';
import { label, display } from '../config/labels';
import type { Row } from '../types/api';
const props = defineProps<{
    resourceKey: string;
    record: Row;
    compact?: boolean;
    actionPath?: string;
  }>(),
  emit = defineEmits<{ changed: [result: Row]; cancel: [] }>();
const selected = ref(''),
  values = ref<Record<string, string>>({}),
  error = ref(''),
  busy = ref(false),
  notice = ref('');
let attempt = writeAttempt();
const definitions: Record<string, { path: string; title: string }[]> = {
  orders: [{ path: 'orders/{id}/transition', title: '变更订单状态' }],
  projects: [
    { path: 'projects/{id}/stage', title: '推进项目阶段' },
    { path: 'projects/{id}/acceptance', title: '提交项目验收' },
  ],
  posts: [
    { path: 'posts/{id}/moderation', title: '审核或管理帖子' },
    { path: 'posts/{id}/reports', title: '举报帖子' },
  ],
  jobs: [{ path: 'jobs/{id}/retry', title: '恢复失败任务' }],
  reports: [{ path: 'reports/{id}/decision', title: '处理举报' }],
  comments: [{ path: 'comments/{id}/moderation', title: '管理评论' }],
  adjudications: [{ path: 'adjudications/{id}/decision', title: '复核用量裁决' }],
};
definitions.contents = [
  { path: 'knowledge/{id}/submit-review', title: '提交审核' },
  { path: 'knowledge/{id}/publish', title: '发布内容' },
  { path: 'knowledge/{id}/withdraw', title: '撤回发布' },
  { path: 'knowledge/{id}/reindex', title: '重新建立索引' },
];
const statusPaths: Record<string, string> = {
  'membership-plans': 'membership-plans',
  'model-prices': 'model-prices',
  'model-keys': 'model-keys',
  schools: 'schools',
  majors: 'majors',
  roles: 'roles',
  menus: 'menus',
  models: 'models',
  'storage-configs': 'storages',
  domains: 'domains',
  categories: 'categories',
  tags: 'tags',
  boards: 'forum-boards',
  users: 'users',
  'notification-templates': 'notification-templates',
};
for (const [key, path] of Object.entries(statusPaths)) {
  definitions[key] = [
    ...(definitions[key] || []),
    { path: `${path}/{id}/status`, title: '启停记录' },
  ];
}
for (const [key, path] of Object.entries({
  models: 'models',
  'storage-configs': 'storages',
  domains: 'domains',
})) {
  definitions[key].push({ path: `${path}/{id}/test`, title: '验证连接配置' });
}
definitions['model-keys'].push({ path: 'model-keys/{id}/rotate', title: '更换模型密钥' });
const recovery = computed(() =>
  jobRecovery(String(props.record.kind || ''), String(props.record.state || '')),
);
const actions = computed(() =>
  (definitions[props.resourceKey] || [])
    .map((d) => ({ ...d, path: `/${auth.platform}/${d.path}` }))
    .filter((d) => {
      // 举报结论只能从OPEN产生；终态不再提供重复处理入口，服务端仍执行CAS与状态校验。
      if (props.resourceKey === 'jobs' && !recovery.value.retry) return false;
      if (props.resourceKey === 'reports' && props.record.state !== 'OPEN') return false;
      if (props.resourceKey === 'adjudications' && props.record.state !== 'PENDING') return false;
      if (d.path.endsWith('/acceptance') && props.record.stage !== 'ACCEPTANCE') return false;
      if (
        d.path.endsWith('/knowledge/{id}/submit-review') &&
        !['DRAFT', 'WITHDRAWN'].includes(String(props.record.state))
      )
        return false;
      if (d.path.endsWith('/knowledge/{id}/publish') && props.record.state !== 'REVIEW')
        return false;
      if (
        d.path.endsWith('/knowledge/{id}/withdraw') &&
        !['REVIEW', 'PUBLISHED'].includes(String(props.record.state))
      )
        return false;
      const o = operation('POST', d.path);
      return o && (!o.permission || auth.permissions.includes(o.permission));
    }),
);
const bodySchema = computed(() => schema(operation('POST', selected.value)?.body));
const fields = computed(() =>
  Object.entries(bodySchema.value.properties || {}).map(([key, v]) => {
    const field = { key, ...schema(v) };
    if (props.resourceKey === 'comments' && key === 'action')
      field.enum = field.enum?.filter((value) => ['APPROVE', 'HIDE'].includes(String(value)));
    return field;
  }),
);
function open(path: string) {
  selected.value = path;
  values.value = {};
  error.value = '';
  attempt = writeAttempt();
}
watch(
  () => props.actionPath,
  (path) => {
    if (path && actions.value.some((action) => action.path === path)) open(path);
  },
  { immediate: true },
);
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const body = formBody(bodySchema.value, values.value);
    const asynchronous = /\/(test|reindex|retry)$/.test(selected.value);
    const result = await request<Row>(selected.value.replace('{id}', String(props.record.id)), {
      method: 'POST',
      body,
      version: operation('POST', selected.value)?.parameters.some((p) => p.name === 'If-Match')
        ? props.record.version
        : undefined,
      key: attempt(body),
    });
    selected.value = '';
    notice.value = asynchronous
      ? `任务已提交，当前状态：${display(result?.state || 'QUEUED')}。请到异步任务页面查看执行结果。`
      : '操作已完成';
    emit('changed', result);
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section
    v-if="actions.length || resourceKey === 'jobs'"
    class="record-actions"
    :class="{ compact }"
  >
    <h3 v-if="!compact && !actionPath">业务操作</h3>
    <p v-if="resourceKey === 'jobs'" class="muted">{{ recovery.message }}</p>
    <div v-if="!actionPath" class="action-buttons">
      <button
        v-for="action in actions"
        :key="action.path"
        class="button"
        @click="open(action.path)"
      >
        {{ action.title }}
      </button>
    </div>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <form v-if="selected" class="action-form" @submit.prevent="submit">
      <label v-for="field in fields" :key="field.key"
        >{{ label(field.key)
        }}<AppSelect v-if="field.enum" v-model="values[field.key]" required>
          <option value="">请选择</option>
          <option v-for="value in field.enum" :key="String(value)" :value="value">
            {{ display(value) }}
          </option></AppSelect
        ><input
          v-else-if="field.writeOnly"
          v-model="values[field.key]"
          type="password"
          autocomplete="new-password"
          :required="bodySchema.required?.includes(field.key)"
        /><textarea
          v-else
          v-model="values[field.key]"
          rows="3"
          :required="bodySchema.required?.includes(field.key)"
          :maxlength="field.maxLength"
        />
      </label>
      <p class="muted">状态变更会由服务端校验业务前置条件，请填写具体原因。</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy">{{ busy ? '提交中…' : '确认提交' }}</button
      ><button
        type="button"
        class="button"
        :disabled="busy"
        @click="
          selected = '';
          emit('cancel');
        "
      >
        取消
      </button>
    </form>
  </section>
</template>
<style scoped>
.record-actions.compact {
  margin: 16px 0;
  padding: 0;
  border: 0;
}
.compact .action-buttons {
  justify-content: flex-end;
}
.compact .action-buttons .button {
  min-height: 30px;
  padding: 5px 10px;
  font-size: 12px;
  color: #7b8798;
}
.record-actions {
  border-top: 1px solid #e2e6ef;
  padding-top: 16px;
  margin-top: 20px;
}
.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.action-form {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}
.action-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
</style>
