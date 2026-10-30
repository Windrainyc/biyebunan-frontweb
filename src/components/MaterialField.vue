<script setup lang="ts">
import { ref, watch } from 'vue';
import MaterialBrowser from './MaterialBrowser.vue';
import { request } from '../api/client';
import type { Row } from '../types/api';
const props = defineProps<{ modelValue: unknown; kind?: string }>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
const opened = ref(false),
  name = ref('');
let generation = 0;
watch(
  () => props.modelValue,
  async (id) => {
    const current = ++generation;
    name.value = '';
    if (!id) return;
    try {
      const row = await request<Row>(`/admin/assets/${id}`);
      if (current === generation) name.value = String(row.filename);
    } catch {
      if (current === generation) name.value = '已关联文件（暂无法读取名称）';
    }
  },
  { immediate: true },
);
function choose(row: Row) {
  emit('update:modelValue', row.id);
  opened.value = false;
}
</script>
<template>
  <div class="material-field">
    <div class="material-field-actions">
      <span>{{ name || (modelValue ? '已关联素材' : '尚未选择文件') }}</span
      ><button type="button" class="button primary" @click="opened = !opened">
        {{ opened ? '收起素材库' : '选择素材 / 上传文件' }}</button
      ><button
        v-if="modelValue"
        type="button"
        class="button"
        @click="emit('update:modelValue', null)"
      >
        移除关联
      </button>
    </div>
    <MaterialBrowser v-if="opened" picker :kind="kind" @selected="choose" />
  </div>
</template>
<style scoped>
.material-field {
  border: 1px solid #dce3f0;
  border-radius: 10px;
  padding: 14px;
  background: #fafbfe;
  min-width: 0;
}
.material-field-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.material-field-actions > span {
  flex: 1;
  min-width: 150px;
  overflow-wrap: anywhere;
  color: #67758f;
  font-size: 13px;
}
</style>
