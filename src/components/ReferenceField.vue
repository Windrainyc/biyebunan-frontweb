<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { auth, request, errorText } from '../api/client';
import { label } from '../config/labels';
import { operation } from '../config/contract';
import type { Row, Page } from '../types/api';
const props = defineProps<{
  modelValue: unknown;
  field: string;
  context?: string;
  filters?: Record<string, unknown>;
  multiple?: boolean;
  required?: boolean;
  dropdown?: boolean;
  placeholder?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
const expanded = ref(false);
const invalid = ref(false);
const trigger = ref<HTMLButtonElement>();
const searchInput = ref<HTMLInputElement>();
async function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    await nextTick();
    searchInput.value?.focus();
  }
}
function close() {
  expanded.value = false;
  trigger.value?.focus();
}
async function revealInvalid() {
  invalid.value = true;
  expanded.value = true;
  await nextTick();
  trigger.value?.focus();
}

const selectedTitles = ref<Record<string, string>>({});
const query = ref(''),
  page = ref(1),
  total = ref(0),
  rows = ref<Row[]>([]),
  error = ref(''),
  busy = ref(false);
const resource: Record<string, string> = {
  packageCode: 'service-packages',
  userId: 'users',
  materialCategoryId: 'material-categories',
  schoolId: 'schools',
  majorId: 'majors',
  roleIds: 'roles',
  roleId: 'roles',
  permissionCodes: 'permissions',
  modelId: 'models',
  modelIds: 'models',
  parentId: 'categories',
  categoryId: 'categories',
  tagIds: 'tags',
  tagId: 'tags',
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
        : props.field === 'categoryId' && props.context === 'materials'
          ? 'material-categories'
          : resource[props.field]) || '';
  const direct = `/${auth.platform}/${name}`;
  return operation('GET', direct) ? direct : `/${auth.platform}/dictionaries/${name}`;
});
const supported = computed(() => !!resource[props.field] && !!operation('GET', path.value));
function value(row: Row) {
  return String(['permissionCodes', 'packageCode'].includes(props.field) ? row.code : row.id);
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
  invalid.value = false;
  const row = rows.value.find((r) => value(r) === id);
  if (row) selectedTitles.value[id] = title(row);
  if (!props.multiple) close();
  emit(
    'update:modelValue',
    props.multiple
      ? selected.value.includes(id)
        ? selected.value.filter((v) => v !== id)
        : [...selected.value, id]
      : id,
  );
}
function closeOutside(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node))
    expanded.value = false;
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
        ...(props.field === 'packageCode' && auth.platform === 'admin'
          ? { status: 'ENABLED' }
          : {}),
        ...(props.field === 'studentId' && auth.platform === 'admin'
          ? { platform: 'student' }
          : props.field === 'partnerId'
            ? { platform: 'partner' }
            : {}),
      },
    });
    if (current !== generation) return;
    rows.value = result.items;
    for (const row of result.items)
      if (selected.value.includes(value(row))) selectedTitles.value[value(row)] = title(row);
    total.value = result.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
watch(
  () => [props.modelValue, path.value],
  async () => {
    const base = path.value;
    const detail = operation('GET', base + '/{id}');
    if (!detail || (detail.permission && !auth.permissions.includes(detail.permission))) return;
    const ids = [...selected.value];
    for (const id of ids) {
      if (selectedTitles.value[id] || props.field === 'packageCode') continue;
      try {
        const row = await request<Row>(base + '/' + encodeURIComponent(id));
        if (base === path.value && selected.value.includes(id))
          selectedTitles.value[id] = title(row);
      } catch {
        /* 不推断无权查看的关联数据名称。 */
      }
    }
  },
  { immediate: true },
);
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
  <div
    class="reference"
    :class="{ dropdown }"
    @keydown.esc.stop.prevent="close"
    @focusout="closeOutside($event)"
  >
    <button
      v-if="dropdown && supported"
      type="button"
      ref="trigger"
      class="dropdown-trigger"
      :aria-expanded="expanded"
      :aria-label="label(field)"
      :aria-invalid="invalid && !selected.length"
      @click="toggle"
    >
      <span>{{
        selected.length
          ? selected
              .map(
                (id) =>
                  selectedTitles[id] ||
                  title(rows.find((r) => value(r) === id) || { name: '已选记录' }),
              )
              .join('、')
          : placeholder || '请选择'
      }}</span
      ><span aria-hidden="true">⌄</span>
    </button>
    <div v-show="!dropdown || expanded || !supported" :class="{ 'dropdown-panel': dropdown }">
      <template v-if="supported"
        ><div class="search">
          <input
            ref="searchInput"
            v-model="query"
            :aria-label="`搜索${label(field)}`"
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
          <button
            v-if="dropdown"
            v-for="row in rows"
            :key="'option-' + value(row)"
            type="button"
            class="dropdown-option"
            :aria-pressed="selected.includes(value(row))"
            @click="choose(value(row))"
          >
            {{ title(row) }}<span v-if="selected.includes(value(row))"> ✓</span>
          </button>
          <template v-else
            ><label v-for="row in rows" :key="value(row)"
              ><input
                :type="multiple ? 'checkbox' : 'radio'"
                :name="field"
                :checked="selected.includes(value(row))"
                @change="choose(value(row))"
              />{{ title(row) }}</label
            ></template
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
      </template>
      <p v-else class="muted">此字段需要在对应业务页面中选择。</p>
    </div>
    <p v-if="invalid && !selected.length" class="error" role="alert">请选择{{ label(field) }}</p>
    <input
      v-if="required"
      class="validation"
      tabindex="-1"
      :value="selected.join(',')"
      required
      aria-label="请选择关联数据"
      @invalid.prevent="revealInvalid"
    />
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

<style scoped>
.reference.dropdown {
  position: relative;
  padding: 0;
  border: 0;
  min-width: 0;
}
.dropdown-trigger {
  width: 100%;
  min-height: 40px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #dce3ee;
  border-radius: 8px;
  background: white;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.dropdown-trigger span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  width: 100%;
  min-width: 0;
  max-width: calc(100vw - 40px);
  padding: 12px;
  border: 1px solid #dce3ee;
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px #26375b24;
}
.dropdown-option {
  border: 0;
  background: transparent;
  padding: 8px;
  text-align: left;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
}
.dropdown-option:hover,
.dropdown-option[aria-pressed='true'] {
  background: #eaf4ff;
  color: #2676bd;
}
</style>
