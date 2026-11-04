<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
const props = defineProps<{ contentId: string }>();
const rows = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  loading = ref(false),
  error = ref('');
const actions: Record<string, string> = {
  CREATED: '新建草稿',
  UPDATED: '编辑草稿',
  REVIEW: '提交审核',
  PUBLISH: '审核发布',
  WITHDRAW: '撤回',
  DELETED: '删除',
};
let generation = 0;
onBeforeUnmount(() => generation++);
async function load() {
  const g = ++generation;
  loading.value = true;
  error.value = '';
  rows.value = [];
  try {
    const result = await request<Page<Row>>(`/admin/knowledge/${props.contentId}/history`, {
      query: { page: page.value, size: 10 },
    });
    if (g !== generation) return;
    rows.value = result.items;
    total.value = result.total;
  } catch (e) {
    if (g === generation) error.value = errorText(e);
  } finally {
    if (g === generation) loading.value = false;
  }
}
watch(
  () => props.contentId,
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <section class="history-section">
    <h2>处理历史</h2>
    <p class="muted">查看提交审核、发布、撤回和编辑的时间与原因。</p>
    <p v-if="loading" role="status">正在读取历史…</p>
    <p v-else-if="error" role="alert" class="error">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <template v-else
      ><ol>
        <li v-for="row in rows" :key="String(row.id)">
          <strong>{{ actions[String(row.action)] || row.action }}</strong
          ><span>{{ row.actorName }} · {{ display(row.createdAt) }}</span>
          <p>{{ row.reason }}</p>
        </li>
      </ol>
      <p v-if="!rows.length">暂无处理历史</p>
      <div class="pagination">
        <span>共 {{ total }} 条</span
        ><button
          class="button"
          :disabled="page === 1"
          @click="
            page--;
            load();
          "
        >
          上一页</button
        ><span>第 {{ page }} 页</span
        ><button
          class="button"
          :disabled="page * 10 >= total"
          @click="
            page++;
            load();
          "
        >
          下一页
        </button>
      </div></template
    >
  </section>
</template>
<style scoped>
.history-section {
  margin-top: 24px;
  border-top: 1px solid #e1e7f0;
  padding-top: 20px;
}
ol {
  padding-left: 20px;
}
li {
  padding: 12px 0;
}
li span {
  display: block;
  color: #68778b;
  font-size: 13px;
  margin-top: 6px;
}
li p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
</style>
