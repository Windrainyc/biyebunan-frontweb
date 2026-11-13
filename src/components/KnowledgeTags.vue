<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { auth, request, errorText } from '../api/client';
import type { Page, Row } from '../types/api';
const props = defineProps<{ modelValue: unknown; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string[]]; pending: [boolean] }>();
const ids = computed(() => (Array.isArray(props.modelValue) ? props.modelValue.map(String) : []));
const names = ref<Record<string, string>>({}),
  query = ref(''),
  results = ref<Row[]>([]),
  error = ref(''),
  busy = ref(false);
const canCreate = computed(() => auth.permissions.includes('tags:write'));
let timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0,
  disposed = false;
const attempts = new Map<string, { key: string; code: string }>();
watch(
  ids,
  async (values) => {
    await Promise.all(
      values
        .filter((id) => !names.value[id])
        .map(async (id) => {
          try {
            const row = await request<Row>('/admin/tags/' + id);
            if (!disposed) names.value[id] = String(row.name);
          } catch {
            /* 保留已有标签标识，不因暂时查询失败删除关联。 */
          }
        }),
    );
  },
  { immediate: true },
);
watch(query, () => {
  clearTimeout(timer);
  const n = ++generation;
  results.value = [];
  error.value = '';
  const q = query.value.trim();
  if (!q) return;
  timer = setTimeout(async () => {
    try {
      const data = await request<Page<Row>>('/admin/tags', {
        query: { q, status: 'ENABLED', page: 1, size: 20 },
      });
      if (n === generation && !disposed) results.value = data.items;
    } catch (e) {
      if (n === generation && !disposed) error.value = errorText(e);
    }
  }, 250);
});
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  clearTimeout(timer);
});
function select(row: Row) {
  if (props.disabled || busy.value) return;
  const id = String(row.id);
  names.value[id] = String(row.name);
  if (!ids.value.includes(id)) emit('update:modelValue', [...ids.value, id]);
  query.value = '';
  results.value = [];
}
function remove(id: string) {
  if (!props.disabled && !busy.value)
    emit(
      'update:modelValue',
      ids.value.filter((v) => v !== id),
    );
}
async function add() {
  const name = query.value.trim();
  if (!name || busy.value || props.disabled) return;
  if (ids.value.some((id) => names.value[id]?.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    query.value = '';
    return;
  }
  busy.value = true;
  emit('pending', true);
  error.value = '';
  try {
    const data = await request<Page<Row>>('/admin/tags', {
      query: { q: name, page: 1, size: 100 },
    });
    let row = data.items.find(
      (t) => String(t.name).toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (row && row.status !== 'ENABLED') throw Error('同名标签已停用，请在标签管理中启用。');
    if (!row) {
      if (!canCreate.value) throw Error('没有新增标签权限，请选择已有标签。');
      let attempt = attempts.get(name);
      if (!attempt) {
        attempt = {
          key: crypto.randomUUID(),
          code: 'tag_' + crypto.randomUUID().replaceAll('-', ''),
        };
        attempts.set(name, attempt);
      }
      row = await request<Row>('/admin/tags', {
        method: 'POST',
        key: attempt.key,
        body: { name, code: attempt.code, status: 'ENABLED' },
      });
    }
    if (!disposed) {
      const id = String(row.id);
      names.value[id] = String(row.name);
      if (!ids.value.includes(id)) emit('update:modelValue', [...ids.value, id]);
      query.value = '';
      results.value = [];
    }
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  } finally {
    busy.value = false;
    if (!disposed) emit('pending', false);
  }
}
</script>
<template>
  <div class="knowledge-tags">
    <div class="tag-input" :class="{ disabled: disabled || busy }">
      <span v-for="id in ids" :key="id" class="tag-chip"
        >{{ names[id] || '已有标签'
        }}<button
          type="button"
          :disabled="disabled || busy"
          :aria-label="'移除标签 ' + (names[id] || '已有标签')"
          @click="remove(id)"
        >
          ×
        </button></span
      >
      <input
        v-model="query"
        aria-label="搜索或新增内容标签"
        placeholder="输入标签，回车添加"
        maxlength="200"
        :disabled="disabled || busy"
        @keydown.enter.prevent="!$event.isComposing && add()"
        @keydown.esc="results = []"
      />
    </div>
    <div v-if="results.length" class="tag-matches" aria-label="匹配的已有标签">
      <button
        v-for="row in results.filter((t) => !ids.includes(String(t.id)))"
        :key="String(row.id)"
        type="button"
        :disabled="disabled || busy"
        @click="select(row)"
      >
        {{ row.name }}
      </button>
    </div>
    <small>{{
      busy
        ? '正在添加…'
        : canCreate
          ? '输入关键词匹配已有标签；回车创建并选中新标签。'
          : '输入关键词匹配已有标签。'
    }}</small>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>
<style scoped>
.knowledge-tags {
  margin-top: 8px;
}
.tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border: 1px solid #ddd6ed;
  border-radius: 9px;
  background: #fff;
  min-height: 40px;
}
.tag-input:focus-within {
  border-color: #9b86e8;
  box-shadow: 0 0 0 3px #eee8ff;
}
.tag-input input {
  flex: 1;
  min-width: 100px;
  width: 100%;
  border: 0;
  box-shadow: none !important;
  outline: 0;
  padding: 3px;
  min-height: 24px;
  background: transparent;
  font-size: 13px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow-wrap: anywhere;
  border-radius: 6px;
  background: #eee8ff;
  color: #7359ae;
  padding: 3px 7px;
  font-size: 12px;
}
.tag-chip button {
  border: 0;
  background: none;
  color: inherit;
  padding: 0 2px;
  cursor: pointer;
}
.tag-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.tag-matches button {
  border: 1px solid #e6def3;
  background: #faf8ff;
  border-radius: 16px;
  padding: 4px 10px;
  color: #705c92;
  font-size: 12px;
  cursor: pointer;
}
small {
  display: block;
  margin-top: 8px;
  color: #91869e;
  line-height: 1.6;
}
.disabled {
  opacity: 0.65;
}
.error {
  font-size: 12px;
}
</style>
