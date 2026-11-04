<script setup lang="ts">
import ContentOutline from './ContentOutline.vue';
import CreatePage from './CreatePage.vue';
import type { Row } from '../types/api';
import { display } from '../config/labels';
import Icon from './Icon.vue';
import ReferenceName from './ReferenceName.vue';
import KnowledgeDetail from './KnowledgeDetail.vue';
import ForumDetail from './ForumDetail.vue';
import RecordActions from './RecordActions.vue';
import MarkdownContent from './MarkdownContent.vue';
import StatusBadge from './StatusBadge.vue';
import { auth } from '../api/client';
withDefaults(defineProps<{ content: Row; kind?: 'knowledge' | 'forum' }>(), { kind: 'knowledge' });
const emit = defineEmits<{ close: []; changed: [] }>();
</script>
<template>
  <CreatePage
    :title="String(content.title)"
    :description="kind === 'forum' ? '答疑广场 · 帖子详情' : '知识库阅读'"
    @back="emit('close')"
  >
    <section class="knowledge-reader reading-page" aria-labelledby="knowledge-reader-title">
      <header class="knowledge-reader-header">
        <div>
          <strong>{{ kind === 'forum' ? '帖子详情' : '知识库阅读' }}</strong>
          <p>
            {{ kind === 'forum' ? '答疑广场' : display(content.type) }} ·
            <ReferenceName
              :field="kind === 'forum' ? 'boardId' : 'categoryId'"
              :value="kind === 'forum' ? content.boardId : content.categoryId"
            />
          </p>
        </div>
        <button
          class="button reader-close"
          :aria-label="kind === 'forum' ? '关闭帖子详情' : '关闭知识阅读'"
          @click="emit('close')"
        >
          <Icon name="close" />
        </button>
      </header>
      <div class="knowledge-reader-scroll">
        <div
          v-if="kind === 'forum'"
          class="knowledge-reader-cover"
          :class="{ 'forum-reader-cover': kind === 'forum' }"
        >
          <p class="eyebrow">
            {{ kind === 'forum' ? '交流讨论' : display(content.type) + '资料' }}
          </p>
          <h2 id="knowledge-reader-title">{{ content.title }}</h2>
          <p>更新于 {{ display(content.updatedAt) }}</p>
        </div>
        <ContentOutline
          v-if="kind === 'forum'"
          :text="String(kind === 'forum' ? content.body || '' : content.markdown || '')"
        />
        <template v-if="kind === 'forum'"
          ><div class="forum-reader-meta">
            <span>{{ content.authorId === auth.user?.id ? '我发布的帖子' : '社区成员发布' }}</span
            ><StatusBadge :value="content.state" />
          </div>
          <MarkdownContent :text="String(content.body || '')" /><RecordActions
            resource-key="posts"
            compact
            :record="content"
            @changed="emit('changed')" /><ForumDetail
            :post="content"
            @changed="emit('changed')" /></template
        ><KnowledgeDetail v-else :content="content" />
      </div>
      <footer v-if="kind === 'knowledge'" class="knowledge-reader-footer">
        <span>仅展示当前账户可阅读的正文与文件</span>
        <RouterLink
          v-if="content.publishedVersionId && content.indexState === 'READY'"
          :to="{
            path: '/student/chat',
            query: { source: String(content.publishedVersionId), title: String(content.title) },
          }"
          class="button primary"
          ><Icon name="sparkles" />引用资料追问</RouterLink
        >
        <RouterLink v-else to="/student/chat" class="button primary"
          ><Icon name="sparkles" />打开智能答疑</RouterLink
        >
      </footer>
    </section>
  </CreatePage>
</template>
<style scoped>
.knowledge-reader-cover.forum-reader-cover {
  background: linear-gradient(125deg, #fbfaf6, #f4eddf);
  color: #283c5b;
  border: 1px solid #eae2d4;
}
.knowledge-reader-cover.forum-reader-cover::after {
  content: '问';
  color: #172a4810;
}
.knowledge-reader-cover.forum-reader-cover p {
  color: #958b7b;
}
.forum-reader-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #8b95a7;
  font-size: 12px;
  margin-bottom: 20px;
}
.knowledge-reader-backdrop {
  position: fixed;
  inset: 0;
  background: #15213b78;
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 120;
}
.knowledge-reader {
  width: min(900px, 100%);
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: white;
  border-radius: 16px;
  box-shadow: 0 28px 90px #14244240;
}
.knowledge-reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
  border-bottom: 1px solid #e8ecf4;
}
.knowledge-reader-header strong {
  font-size: 15px;
}
.knowledge-reader-header p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8a95a8;
}
.reader-close {
  width: 34px;
  min-height: 34px;
  padding: 0;
  border: 0;
  background: #f5f7fb;
}
.knowledge-reader-scroll {
  padding: 24px 28px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.knowledge-reader-cover {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: white;
  background: linear-gradient(130deg, #253e65, #506e8e);
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
}
.knowledge-reader-cover::after {
  content: '知';
  position: absolute;
  right: 18px;
  bottom: -20px;
  font: 120px var(--serif);
  color: #ffffff16;
  z-index: -1;
}
.knowledge-reader-cover h2 {
  max-width: 650px;
  margin: 12px 0;
  font: 600 26px/1.5 var(--serif);
}
.knowledge-reader-cover p {
  color: #c3d0e2;
  font-size: 12px;
  margin: 0;
}
.knowledge-reader-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 28px;
  border-top: 1px solid #e8ecf4;
  background: #fcfdff;
}
.knowledge-reader-footer span {
  font-size: 11px;
  color: #8a96ab;
}
@media (max-width: 600px) {
  .knowledge-reader-backdrop {
    padding: 12px;
  }
  .knowledge-reader {
    max-height: calc(100dvh - 24px);
  }
  .knowledge-reader-header,
  .knowledge-reader-scroll {
    padding: 18px;
  }
  .knowledge-reader-cover h2 {
    font-size: 22px;
  }
  .knowledge-reader-footer {
    padding: 14px 18px;
    flex-wrap: wrap;
  }
}
</style>

<style scoped>
.reading-page {
  width: 100%;
  max-height: none;
  border: 0;
  box-shadow: none;
}
.reading-page .knowledge-reader-scroll {
  overflow: visible;
  padding: 0;
}
.reading-page .knowledge-reader-header {
  display: none;
}
.reading-page .knowledge-reader-cover {
  padding: 20px;
  min-height: 0;
  margin-bottom: 20px;
}
.reading-page .knowledge-reader-footer {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px 0;
  flex-wrap: wrap;
  gap: 12px;
}
.reading-page :deep(.markdown-content) {
  font-size: 16px;
  line-height: 1.85;
}
</style>
