<script setup lang="ts">
import type { Schema } from '../types/api';
import { label, display } from '../config/labels';
import ReferenceField from './ReferenceField.vue';
const props = defineProps<{
  modelValue: unknown;
  field: Schema & { key: string };
  required?: boolean;
  context?: string;
  filters?: Record<string, unknown>;
}>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();
function input(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
function required() {
  return props.required && !(Array.isArray(props.field.type) && props.field.type.includes('null'));
}
function localTime(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
</script>
<template>
  <ReferenceField
    v-if="field.format === 'uuid' || field.type === 'array'"
    :model-value="modelValue"
    :field="field.key"
    :context="context"
    :filters="filters"
    :multiple="field.type === 'array'"
    :required="required()"
    :aria-label="label(field.key)"
    @update:model-value="emit('update:modelValue', $event)"
  /><select
    v-else-if="field.enum"
    :value="modelValue"
    :required="required()"
    :aria-label="label(field.key)"
    @change="input"
  >
    <option value="">请选择</option>
    <option v-for="value in field.enum" :key="String(value)" :value="value">
      {{ display(value) }}
    </option></select
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
    rows="4"
    @input="input"
  /><input
    v-else
    :value="field.format === 'date-time' ? localTime(modelValue) : String(modelValue ?? '')"
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
