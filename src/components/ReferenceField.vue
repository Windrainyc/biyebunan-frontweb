<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import type { Row, Page } from '../types/api';
const props = defineProps<{
  modelValue: unknown;
  field: string;
  context?: string;
  filters?: Record<string, unknown>;
  multiple?: boolean;
  required?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
const query = ref(''),
  page = ref(1),
  total = ref(0),
  rows = ref<Row[]>([]),
  error = ref(''),
  busy = ref(false);
const resource: Record<string, string> = {
  materialCategoryId: 'material-categories',
  schoolId: 'schools',
  majorId: 'majors',
  roleIds: 'roles',
  permissionCodes: 'permissions',
  modelId: 'models',
  modelIds: 'models',
  parentId: 'categories',
  categoryId: 'categories',
  tagIds: 'tags',
  orderId: 'orders',
  projectId: 'projects',
  boardId: 'forum-boards',
  studentId: 'users',
  partnerId: 'users',
  planId: 'membership-plans',
  membershipPlanId: 'membership-plans',
  storageId: 'storages',
  storageConfigId: 'storages',
};
const path = computed(() => {
  const name =
    (props.field === 'studentId' && auth.platform === 'partner'
      ? 'students'
      : props.field === 'parentId' && props.context === 'menus'
        ? 'menus'
        : resource[props.field]) || '';
  const direct = `/${auth.platform}/${name}`;
  return operation('GET', direct) ? direct : `/${auth.platform}/dictionaries/${name}`;
});
const supported = computed(() => !!resource[props.field] && !!operation('GET', path.value));
function value(row: Row) {
  return String(props.field === 'permissionCodes' ? row.code : row.id);
}
function title(row: Row) {
  return String(
    row.name || row.title || row.displayName || row.description || row.code || '未命名记录',
  );
}
const selected = computed(() =>
  Array.isArray(props.modelValue)
    ? props.modelValue.map(String)
    : props.modelValue
      ? [String(props.modelValue)]
      : [],
);
function choose(id: string) {
  emit(
    'update:modelValue',
    props.multiple
      ? selected.value.includes(id)
        ? selected.value.filter((v) => v !== id)
        : [...selected.value, id]
      : id,
  );
}
let generation = 0;
async function load() {
  const current = ++generation;
  rows.value = [];
  total.value = 0;
  error.value = '';
  busy.value = false;
  if (!supported.value) return;
  busy.value = true;
  try {
    const result = await request<Page<Row>>(path.value, {
      query: {
        page: page.value,
        size: 20,
        q: query.value,
        ...props.filters,
        ...(props.field === 'studentId' && auth.platform === 'admin'
          ? { platform: 'student' }
          : props.field === 'partnerId'
            ? { platform: 'partner' }
            : {}),
      },
    });
    if (current !== generation) return;
    rows.value = result.items;
    total.value = result.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  generation++;
});
watch(
  () => props.filters,
  () => {
    page.value = 1;
    void load();
  },
  { deep: true },
);
</script>
<template>
  <div class="reference">
    <template v-if="supported"
      ><div class="search">
        <input
          v-model="query"
          placeholder="搜索并选择"
          @keydown.enter.prevent="
            page = 1;
            load();
          "
        /><button
          type="button"
          class="button"
          @click="
            page = 1;
            load();
          "
        >
          搜索
        </button>
      </div>
      <div class="choices">
        <label v-for="row in rows" :key="value(row)"
          ><input
            :type="multiple ? 'checkbox' : 'radio'"
            :name="field"
            :checked="selected.includes(value(row))"
            @change="choose(value(row))"
          />{{ title(row) }}</label
        ><span v-if="!rows.length">{{
          busy ? '加载中…' : error ? '查询失败，请重新搜索' : '暂无可选数据'
        }}</span>
      </div>
      <div class="reference-foot">
        <span>已选 {{ selected.length }} 项</span>
        <button
          v-if="!required && selected.length"
          type="button"
          class="button"
          @click="emit('update:modelValue', multiple ? [] : '')"
        >
          清空选择
        </button>
        <button
          type="button"
          :disabled="page === 1 || busy"
          @click="
            page--;
            load();
          "
        >
          上一页</button
        ><button
          type="button"
          :disabled="page * 20 >= total || busy"
          @click="
            page++;
            load();
          "
        >
          下一页
        </button>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <input
        v-if="required"
        class="validation"
        tabindex="-1"
        :value="selected.join(',')"
        required
        aria-label="请选择关联数据"
    /></template>
    <p v-else class="muted">此字段需要在对应业务页面中选择。</p>
  </div>
</template>
<style scoped>
.reference {
  border: 1px solid #e2e6ef;
  padding: 10px;
  border-radius: 8px;
}
.search {
  display: flex;
  gap: 6px;
}
.search .button {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 8px 12px;
}
.search input {
  min-width: 0;
  width: 100%;
}
.choices {
  max-height: 160px;
  overflow: auto;
  margin: 10px 0;
  display: grid;
  gap: 8px;
}
.choices label {
  display: flex;
  gap: 8px;
  align-items: center;
}
.reference-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  align-items: center;
}
.reference-foot button {
  background: none;
  border: 0;
  color: #2c4bdb;
  cursor: pointer;
}
.reference-foot button:disabled {
  color: #a4afc0;
}
.validation {
  width: 1px;
  height: 1px;
  opacity: 0;
  position: absolute;
}
</style>
