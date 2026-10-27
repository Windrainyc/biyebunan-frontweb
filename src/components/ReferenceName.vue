<script setup lang="ts">
import { ref, watch } from 'vue';
import { dictionaryRows } from '../api/dictionary';
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
  authorId: 'users',
  membershipPlanId: 'membership-plans',
  storageId: 'storages',
};
let generation = 0;
watch(
  () => [props.field, props.value, auth.user?.id],
  async () => {
    const current = ++generation;
    name.value = '';
    if (auth.user && props.field === 'authorId' && props.value === auth.user.id) {
      name.value = auth.user.displayName;
      return;
    }
    if (!props.value || !resources[props.field]) return;
    const base = `/${auth.platform}/${resources[props.field]}`;
    const op = operation('GET', base + '/{id}');
    const dictionary = `/${auth.platform}/dictionaries/${resources[props.field]}`;
    const dictOp = operation('GET', dictionary);
    try {
      let row: Row | undefined;
      if (op && (!op.permission || auth.permissions.includes(op.permission))) {
        row = await request<Row>(`${base}/${props.value}`);
      } else if (dictOp && (!dictOp.permission || auth.permissions.includes(dictOp.permission))) {
        row = (await dictionaryRows(dictionary, auth.user?.id || '')).find(
          (item) => item.id === props.value,
        );
      }
      if (!row) return;
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
    name ||
    (!value
      ? '—'
      : field === 'authorId'
        ? '社区成员'
        : resources[field]
          ? '关联记录（当前不可查看）'
          : display(value))
  }}</span>
</template>
