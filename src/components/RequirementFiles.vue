<script setup lang="ts">
import MaterialField from './MaterialField.vue';
const props = defineProps<{ modelValue: unknown }>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
function values(): unknown[] {
  return Array.isArray(props.modelValue) ? props.modelValue : [];
}
function update(index: number, value: unknown) {
  const list = [...values()];
  list[index] = value;
  emit('update:modelValue', list.filter(Boolean));
}
</script>
<template>
  <div class="requirement-files">
    <div v-for="(id, index) in values()" :key="String(id)">
      <MaterialField :model-value="id" @update:model-value="update(index, $event)" />
    </div>
    <MaterialField
      v-if="values().length < 20"
      :model-value="null"
      @update:model-value="update(values().length, $event)"
    />
    <small>支持图片、文档、压缩包等素材；上传扫描通过后可关联，最多20个。</small>
  </div>
</template>
<style scoped>
.requirement-files {
  display: grid;
  gap: 12px;
}
small {
  color: #718198;
}
</style>
