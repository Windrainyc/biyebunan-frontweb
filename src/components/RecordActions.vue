<script setup lang="ts">
import { recordActions } from '../config/record-actions';
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
  emit = defineEmits<{ changed: [result: Row]; cancel: []; busy: [value: boolean] }>();
const selected = ref(''),
  values = ref<Record<string, string>>({}),
  error = ref(''),
  busy = ref(false),
  notice = ref('');
const taskId = ref('');
let attempt = writeAttempt();
const recovery = computed(() =>
  jobRecovery(String(props.record.kind || ''), String(props.record.state || '')),
);
const actions = computed(() =>
  recordActions(props.resourceKey, props.record).filter((a) => a.method !== 'GET'),
);
const bodySchema = computed(() => schema(operation('POST', selected.value)?.body));
const fields = computed(() =>
  Object.entries(bodySchema.value.properties || {}).map(([key, v]) => {
    const field = { key, ...schema(v) };
    if (props.resourceKey === 'orders' && key === 'action') {
      const allowed: Record<string, string[]> = {
        ACTIVE: ['COMPLETE', 'CANCEL'],
        COMPLETED: ['ARCHIVE'],
        DRAFT: ['CONFIRM', 'CANCEL'],
        CONFIRMED: ['ACTIVATE', 'CANCEL'],
      };
      field.enum = field.enum?.filter((value) =>
        (allowed[String(props.record.status)] || []).includes(String(value)),
      );
    }
    if (props.resourceKey === 'comments' && key === 'action')
      field.enum = field.enum?.filter((value) => ['APPROVE', 'HIDE'].includes(String(value)));
    if (props.resourceKey === 'posts' && key === 'action') {
      const state = String(props.record.state);
      field.enum = field.enum?.filter(
        (value) =>
          value === 'HIDE' ||
          (value === 'APPROVE' && ['PENDING', 'HIDDEN'].includes(state)) ||
          (value === 'LOCK' && state === 'PUBLISHED') ||
          (value === 'UNLOCK' && state === 'LOCKED') ||
          (value === 'PIN' && !props.record.pinned && ['PUBLISHED', 'LOCKED'].includes(state)) ||
          (value === 'UNPIN' && props.record.pinned),
      );
    }
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
    taskId.value = asynchronous ? String(result?.id || '') : '';
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
watch(busy, (value) => emit('busy', value));
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
    <p v-if="notice" class="success" role="status">
      {{ notice }}
      <RouterLink
        v-if="resourceKey === 'domains' && taskId"
        :to="{ path: '/admin/jobs', query: { view: taskId } }"
        >查看检查结果</RouterLink
      >
    </p>
    <form v-if="selected" class="action-form" @submit.prevent="submit">
      <label v-for="field in fields" :key="field.key"
        >{{
          resourceKey === 'posts' && field.key === 'action'
            ? '审核结果'
            : field.key === 'reason' && !bodySchema.required?.includes('reason')
              ? '处理原因（选填）'
              : label(field.key)
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
      <p class="muted">状态变更会校验业务前置条件；备注可按需填写。</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="action-footer">
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
      </div>
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

<style scoped>
.action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.action-footer .button {
  width: auto;
  min-width: 88px;
}
</style>
