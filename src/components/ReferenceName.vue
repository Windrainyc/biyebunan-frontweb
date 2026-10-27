<script setup lang="ts">
import { ref, watch } from 'vue';
import { auth, request } from '../api/client';
import { operation } from '../config/contract';
import { display } from '../config/labels';
import type { Row } from '../types/api';
const props = defineProps<{ field: string; value: unknown }>(),
  name = ref('');
const resources: Record<string, string> = {
  schoolId: 'schools',
  majorId: 'majors',
  modelId: 'models',
  orderId: 'orders',
  projectId: 'projects',
  categoryId: 'categories',
  boardId: 'forum-boards',
  partnerId: 'users',
  studentId: 'users',
  membershipPlanId: 'membership-plans',
  storageId: 'storages',
};
let generation = 0;
watch(
  () => [props.field, props.value, auth.user?.id],
  async () => {
    const current = ++generation;
    name.value = '';
    if (!props.value || !resources[props.field]) return;
    const base = `/${auth.platform}/${resources[props.field]}`;
    const op = operation('GET', base + '/{id}');
    if (!op || (op.permission && !auth.permissions.includes(op.permission))) return;
    try {
      const row = await request<Row>(`${base}/${props.value}`);
      if (current === generation)
        name.value = String(row.name || row.title || row.displayName || row.orderNo || '关联记录');
    } catch {
      /* 撤权或记录不可见时不推断关联身份。 */
    }
  },
  { immediate: true },
);
</script>
<template>
  <span>{{
    name || (!value ? '—' : resources[field] ? '关联记录（当前不可查看）' : display(value))
  }}</span>
</template>
