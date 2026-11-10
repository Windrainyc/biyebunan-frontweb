<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { request, errorText } from '../api/client';
import type { Page, Row } from '../types/api';
import Icon from './Icon.vue';
defineProps<{ modelValue: unknown; horizontal?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const rows = ref<Row[]>([]),
  page = ref(0),
  total = ref(0),
  busy = ref(false),
  error = ref('');
let disposed = false;
async function load() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await request<Page<Row>>('/student/dictionaries/categories', {
      query: { page: page.value + 1, size: 20 },
    });
    if (disposed) return;
    // 下一页失败不推进页码，重试仍读取同一页；分类数量不伪装为内容数量。
    rows.value = [
      ...new Map([...rows.value, ...result.items].map((row) => [row.id, row])).values(),
    ];
    page.value++;
    total.value = result.total;
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  } finally {
    if (!disposed) busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
});
</script>
<template>
  <aside class="knowledge-category-nav" :class="{ horizontal }" aria-label="知识分类">
    <h2>按分类浏览</h2>
    <button
      :class="{ active: !modelValue }"
      :aria-pressed="!modelValue"
      @click="emit('update:modelValue', '')"
    >
      <Icon name="grid" />全部内容
    </button>
    <button
      v-for="row in rows"
      :key="String(row.id)"
      :class="{ active: modelValue === row.id }"
      :aria-pressed="modelValue === row.id"
      @click="emit('update:modelValue', String(row.id))"
    >
      <Icon name="folder" />{{ row.name }}
    </button>
    <p v-if="error" class="error" role="alert">
      {{ error }}<button @click="load">重试分类</button>
    </p>
    <p v-else-if="busy" class="muted" role="status">正在读取分类…</p>
    <p v-else-if="!rows.length" class="muted">暂无可用分类</p>
    <button v-if="!error && rows.length < total" :disabled="busy" @click="load">
      加载更多分类
    </button>
    <div class="knowledge-category-help">
      <Icon name="sparkles" /><strong>找不到想要的？</strong>
      <p>进入智能答疑，围绕项目问题继续交流。</p>
      <RouterLink to="/student/chat">去提问 <Icon name="right" /></RouterLink>
    </div>
  </aside>
</template>
<style scoped>
.knowledge-category-nav.horizontal {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  border: 0;
  padding: 0;
  background: transparent;
}
.horizontal h2,
.horizontal .knowledge-category-help,
.horizontal button .ali-icon {
  display: none;
}
.horizontal button {
  width: auto;
  padding: 10px 14px;
  font-size: 12px;
  white-space: nowrap;
}
.horizontal button.active {
  background: #ede8fc;
  color: #7b61af;
  font-weight: 600;
}
.horizontal p {
  margin: 0;
}

.knowledge-category-help {
  border-top: 1px solid #e8ecf4;
  margin: 20px 12px 0;
  padding-top: 20px;
  color: #7887a2;
}
.knowledge-category-help > .ali-icon {
  display: block;
  color: #525fbb;
  margin-bottom: 12px;
}
.knowledge-category-help strong {
  display: block;
  color: #445572;
  font-size: 13px;
}
.knowledge-category-help p {
  padding: 0;
  line-height: 1.8;
  font-size: 12px;
}
.knowledge-category-help a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #455ab5;
  font-size: 12px;
}
.knowledge-category-nav {
  align-self: start;
  background: white;
  border: 1px solid #e5e8ef;
  border-radius: 14px;
  padding: 18px 10px;
}
h2 {
  margin: 0 12px 16px;
  font-size: 13px;
  color: #8791a2;
  font-weight: 500;
}
button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 13px 12px;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: #65718a;
  border-radius: 8px;
}
button.active,
button:hover {
  background: #eeeffc;
  color: #414bb4;
}
p {
  font-size: 12px;
  padding: 0 12px;
}
@media (max-width: 800px) {
  .knowledge-category-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    max-width: 100%;
    padding: 8px;
  }
  .knowledge-category-nav h2,
  .knowledge-category-help {
    display: none;
  }
  .knowledge-category-nav button {
    width: auto;
    min-width: max-content;
    padding: 10px 12px;
  }
  .knowledge-category-nav p {
    min-width: 160px;
  }
}
</style>
