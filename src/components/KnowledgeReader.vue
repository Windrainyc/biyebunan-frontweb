<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { knowledgeChapters } from './knowledgeChapters';
import MarkdownContent from './MarkdownContent.vue';
const props = defineProps<{ text: string }>();
const page = ref(0),
  scrolling = ref(false),
  reader = ref<HTMLElement>();
const chapters = computed(() => knowledgeChapters(props.text));
function select(index: number) {
  page.value = index;
  reader.value?.scrollTo({ top: 0 });
}
watch(
  () => props.text,
  () => select(0),
);
</script>
<template>
  <section class="paged-reader">
    <header>
      <span>阅读模式</span
      ><button class="text-button" @click="scrolling = !scrolling">
        {{ scrolling ? '切换章节翻页' : '切换连续阅读' }}
      </button>
    </header>
    <div class="reader-layout">
      <nav aria-label="文章目录">
        <button
          v-for="(chapter, i) in chapters"
          :key="i"
          :class="{ selected: i === page }"
          @click="
            scrolling = false;
            select(i);
          "
        >
          {{ chapter.title }}
        </button>
      </nav>
      <div class="reader-body">
        <article ref="reader" tabindex="0" aria-label="知识正文">
          <MarkdownContent :text="scrolling ? text : chapters[page]?.text || ''" />
        </article>
        <footer v-if="!scrolling">
          <button class="button" :disabled="page === 0" @click="select(page - 1)">← 上一页</button
          ><span>{{ page + 1 }} / {{ chapters.length }}</span
          ><button class="button" :disabled="page >= chapters.length - 1" @click="select(page + 1)">
            下一页 →
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>
<style scoped>
.paged-reader {
  border: 1px solid #e4eaf4;
  border-radius: 14px;
  background: white;
  overflow: hidden;
}
.paged-reader > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #edf0f6;
  font-size: 13px;
  color: #7c899f;
}
.reader-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  height: clamp(260px, calc(100dvh - 390px), 760px);
}
nav {
  overflow: auto;
  background: #f7f9fc;
  padding: 16px 12px;
}
nav button {
  display: block;
  width: 100%;
  background: transparent;
  border: 0;
  text-align: left;
  padding: 12px;
  border-radius: 7px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
nav .selected {
  background: #eaf0ff;
  color: #315cde;
}
.reader-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
article {
  overflow: auto;
  flex: 1;
  padding: 24px 30px;
  overscroll-behavior: contain;
}
footer {
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #edf0f6;
  font-size: 12px;
  color: #8290a6;
}
@media (max-width: 650px) {
  .reader-layout {
    grid-template-columns: 1fr;
  }
  nav {
    display: none;
  }
  article {
    padding: 18px;
  }
  footer {
    padding: 12px;
  }
}
</style>
