<script setup lang="ts">
import { computed } from 'vue';
import MarkdownContent from './MarkdownContent.vue';
import ForumMedia from './ForumMedia.vue';
const props = defineProps<{ text: string; assetIds?: unknown }>();
const parts = computed(() =>
  props.text
    .split(/(\[\[asset:[0-9a-f-]{36}\]\])/gi)
    .map((text) => ({ text, id: /^\[\[asset:([0-9a-f-]{36})\]\]$/i.exec(text)?.[1] })),
);
const allowed = computed(() => (Array.isArray(props.assetIds) ? props.assetIds.map(String) : []));
</script>
<template>
  <div>
    <template v-for="(part, i) in parts" :key="i"
      ><ForumMedia v-if="part.id && allowed.includes(part.id)" :id="part.id" /><MarkdownContent
        v-else
        :text="part.text"
    /></template>
  </div>
</template>
