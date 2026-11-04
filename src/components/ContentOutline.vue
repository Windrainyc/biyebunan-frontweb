<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ text: string }>();
const headings = computed(() => {
  let fenced = false;
  return props.text.split('\n').flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return [];
    }
    if (fenced) return [];
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    return match ? [{ level: match[1]!.length, title: match[2]!.replace(/[*_`]/g, '') }] : [];
  });
});
function locate(title: string) {
  const headings = [
    ...document.querySelectorAll('.reading-page h1, .reading-page h2, .reading-page h3'),
  ];
  headings
    .find((element) => element.textContent?.trim() === title)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
</script>
<template>
  <details v-if="headings.length > 1" class="reading-outline">
    <summary>文章目录（{{ headings.length }}）</summary>
    <nav aria-label="文章目录">
      <button
        v-for="(heading, index) in headings"
        :key="index"
        type="button"
        :style="{ paddingLeft: (heading.level - 1) * 12 + 'px' }"
        @click="locate(heading.title)"
      >
        {{ heading.title }}
      </button>
    </nav>
  </details>
</template>
<style scoped>
.reading-outline {
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #e1e7f0;
  border-radius: 8px;
}
.reading-outline nav {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.reading-outline button {
  text-align: left;
  color: #24559d;
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 14px;
}
</style>
