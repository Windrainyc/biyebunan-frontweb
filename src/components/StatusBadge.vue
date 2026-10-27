<script setup lang="ts">
import { computed } from 'vue';
import { display } from '../config/labels';
const props = defineProps<{ value: unknown }>();
const tone = computed(() =>
  [
    'ENABLED',
    'SUCCEEDED',
    'COMPLETED',
    'DONE',
    'READY',
    'SETTLED',
    'APPROVED',
    'PUBLISHED',
  ].includes(String(props.value))
    ? 'good'
    : ['FAILED', 'REJECTED', 'DEAD', 'DISABLED', 'CANCELLED'].includes(String(props.value))
      ? 'bad'
      : ['PENDING', 'RUNNING', 'QUEUED', 'RECONCILING', 'RESERVED', 'PENDING_REVIEW'].includes(
            String(props.value),
          )
        ? 'warn'
        : '',
);
</script>
<template>
  <span class="badge" :class="tone">{{ display(value) }}</span>
</template>
