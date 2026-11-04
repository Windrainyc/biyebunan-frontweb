<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
const KnowledgeEditor = defineAsyncComponent(() => import('./KnowledgeEditor.vue'));
import RequirementFiles from './RequirementFiles.vue';
import MaterialField from './MaterialField.vue';
import AppSelect from './AppSelect.vue';
import type { Schema } from '../types/api';
import { localDateTime, requiresSelection } from '../config/form';
import { label, display } from '../config/labels';
import ReferenceField from './ReferenceField.vue';
const props = defineProps<{
  modelValue: unknown;
  field: Schema & { key: string };
  required?: boolean;
  filter?: boolean;
  context?: string;
  filters?: Record<string, unknown>;
}>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
function input(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
function required() {
  return requiresSelection(props.field, props.required);
}
</script>
<template>
  <RequirementFiles
    v-if="context === 'projects' && field.key === 'requirementAssetIds'"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <KnowledgeEditor
    v-else-if="context === 'contents' && field.key === 'markdown'"
    :model-value="modelValue"
    :max-length="field.maxLength"
    :required="required()"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <MaterialField
    v-else-if="context === 'contents' && ['assetId', 'coverAssetId'].includes(field.key)"
    :model-value="modelValue"
    :kind="
      field.key === 'coverAssetId'
        ? 'IMAGE'
        : filters?.contentType === 'VIDEO'
          ? 'VIDEO'
          : undefined
    "
    @update:model-value="emit('update:modelValue', $event)"
  />
  <p v-else-if="field.key === 'assetIds'" class="muted">
    保存后可在详情中上传并关联附件，已有附件将保留。
  </p>
  <ReferenceField
    v-else-if="field.key === 'packageCode' || field.format === 'uuid' || field.type === 'array'"
    :model-value="modelValue"
    :field="field.key"
    :context="context"
    :filters="filters"
    :multiple="field.type === 'array'"
    :dropdown="true"
    :placeholder="filter ? '全部（请选择）' : '请选择'"
    :required="required()"
    :aria-label="label(field.key)"
    @update:model-value="emit('update:modelValue', $event)"
  /><AppSelect
    v-else-if="field.enum"
    :model-value="modelValue"
    :required="required()"
    :aria-label="label(field.key)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <option value="">请选择</option>
    <option v-for="value in field.enum" :key="String(value)" :value="value">
      {{ display(value) }}
    </option></AppSelect
  ><AppSelect
    v-else-if="filter && field.type === 'boolean'"
    :model-value="modelValue === true ? 'true' : modelValue === false ? 'false' : ''"
    :aria-label="label(field.key)"
    @update:model-value="emit('update:modelValue', $event === '' ? '' : $event === 'true')"
  >
    <option value="">全部</option>
    <option value="true">是</option>
    <option value="false">否</option> </AppSelect
  ><input
    v-else-if="field.type === 'boolean'"
    type="checkbox"
    :checked="modelValue === true"
    :aria-label="label(field.key)"
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  /><textarea
    v-else-if="
      field.maxLength && field.maxLength > 500 && field.format !== 'uri' && !field.writeOnly
    "
    :value="String(modelValue ?? '')"
    :maxlength="field.maxLength"
    :required="required()"
    :aria-label="label(field.key)"
    :rows="['body', 'markdown'].includes(field.key) ? 8 : 4"
    @input="input"
  /><input
    v-else
    :value="field.format === 'date-time' ? localDateTime(modelValue) : String(modelValue ?? '')"
    :type="
      field.writeOnly
        ? 'password'
        : field.type === 'integer' || field.type === 'number'
          ? 'number'
          : field.format === 'date-time'
            ? 'datetime-local'
            : field.format === 'date'
              ? 'date'
              : 'text'
    "
    :step="field.format === 'date-time' ? '0.001' : field.type === 'number' ? 'any' : undefined"
    :min="field.minimum"
    :max="field.maximum"
    :minlength="field.minLength"
    :maxlength="field.maxLength"
    :pattern="field.pattern"
    :required="required()"
    :aria-label="label(field.key)"
    :autocomplete="field.writeOnly ? 'new-password' : undefined"
    @input="input"
  />
</template>
