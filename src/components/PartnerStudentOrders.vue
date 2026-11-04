<script setup lang="ts">
import { watch, ref, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import type { Row, Page } from '../types/api';
import StatusBadge from './StatusBadge.vue';
const props = defineProps<{ studentId: string }>();
const rows = ref<Row[]>([]),
  total = ref(0),
  page = ref(1),
  loading = ref(false),
  error = ref('');
let generation = 0;
onBeforeUnmount(() => generation++);
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  rows.value = [];
  try {
    const result = await request<Page<Row>>('/partner/orders', {
      query: { studentId: props.studentId, page: page.value, size: 10 },
    });
    if (current !== generation) return;
    rows.value = result.items;
    total.value = result.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => props.studentId,
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);
</script>
<template>
  <section class="student-orders">
    <h2>关联订单</h2>
    <p class="muted">仅显示你有权查看的该学生订单。</p>
    <p v-if="loading" role="status">正在读取订单…</p>
    <p v-else-if="error" class="error" role="alert">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <template v-else>
      <RouterLink
        v-for="row in rows"
        :key="String(row.id)"
        :to="{ path: '/partner/orders', query: { view: String(row.id) } }"
        class="student-order-row"
      >
        <span
          ><strong>{{ row.title }}</strong
          ><small>{{ row.orderNo }}</small></span
        ><StatusBadge :value="row.status" />
      </RouterLink>
      <p v-if="!rows.length" class="muted">暂无关联订单</p>
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
      </div>
    </template>
  </section>
</template>
<style scoped>
.student-orders {
  margin-top: 24px;
  border-top: 1px solid #e1e7f0;
  padding-top: 20px;
}
.student-order-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #edf0f5;
}
.student-order-row small {
  display: block;
  color: #68778b;
  margin-top: 5px;
}
.pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  align-items: center;
}
</style>
