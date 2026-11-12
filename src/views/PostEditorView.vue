<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import type { Row, Page } from '../types/api';
import ReferenceField from '../components/ReferenceField.vue';
import KnowledgeEditor from '../components/KnowledgeEditor.vue';
import ForumBody from '../components/ForumBody.vue';
import AssetUpload from '../components/AssetUpload.vue';
import CompactDialog from '../components/CompactDialog.vue';
const route = useRoute(),
  router = useRouter();
const title = ref(''),
  body = ref(''),
  board = ref<unknown>(''),
  tagQuery = ref(''),
  tags = ref<{ id?: string; name: string }[]>([]),
  suggestions = ref<Row[]>([]);
const post = ref<Row | null>(null),
  busy = ref(false),
  loading = ref(false),
  uploading = ref(false),
  mediaOpen = ref(false),
  preview = ref(false),
  error = ref(''),
  notice = ref('');
const drafts = ref<Row[]>([]);
async function loadDrafts() {
  try { drafts.value = (await request<Page<Row>>('/student/posts', {query:{state:'DRAFT',page:1,size:20}})).items; }
  catch(e) {error.value = errorText(e);}
}
const attempt = writeAttempt();
let searchGeneration = 0;
let saved = '';
let leaving = false;
const assetIds = computed(() => [
  ...new Set([...body.value.matchAll(/\[\[asset:([0-9a-f-]{36})\]\]/gi)].map((m) => m[1]!)),
]);
const snapshot = () => JSON.stringify([title.value, body.value, board.value, tags.value]);
onBeforeRouteLeave(
  () => leaving || snapshot() === saved || window.confirm('还有未保存的内容，确定离开？'),
);
function addTag(name: string, id?: string) {
  name = name.trim().normalize('NFKC');
  if (!name) return;
  if (tags.value.length >= 5) {
    error.value = '最多选择5个标签';
    return;
  }
  if (name.length > 30) {
    error.value = '标签最多30字';
    return;
  }
  if (!tags.value.some((t) => t.name.toLowerCase() === name.toLowerCase()))
    tags.value.push({ id, name });
  searchGeneration++;
  tagQuery.value = '';
  suggestions.value = [];
}
async function searchTags() {
  const n = ++searchGeneration;
  if (!tagQuery.value.trim()) {
    suggestions.value = [];
    return;
  }
  try {
    const data = await request<Page<Row>>('/student/dictionaries/tags', {
      query: { q: tagQuery.value.trim(), page: 1, size: 8 },
    });
    if (n === searchGeneration) suggestions.value = data.items;
  } catch (e) {
    if (n === searchGeneration) error.value = errorText(e);
  }
}
async function save(draft = false) {
  if (busy.value || uploading.value) return;
  if (!board.value) {
    error.value = '请选择板块';
    return;
  }
  if (!draft && (!title.value.trim() || !body.value.trim())) {
    error.value = '请填写标题和正文';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const payload = {
      boardId: board.value,
      title: title.value.trim() || '未命名草稿',
      body: body.value.trim() || '草稿',
      tagIds: tags.value.filter((t) => t.id).map((t) => t.id!),
      tagNames: tags.value.filter((t) => !t.id).map((t) => t.name),
      assetIds: assetIds.value,
      draft,
    };
    const result = await request<Row>(
      post.value ? `/student/posts/${post.value.id}` : '/student/posts',
      {
        method: post.value ? 'PUT' : 'POST',
        body: payload,
        version: post.value?.version,
        key: attempt(payload),
      },
    );
    post.value = result;
    saved = snapshot();
    notice.value = draft ? '草稿已保存，仅自己可见' : '帖子已发布';
    if (!draft) {
      leaving = true;
      await router.push({ path: '/student/posts', query: { view: String(result.id) } });
    } else
      await router.replace({ path: '/student/posts/new', query: { draft: String(result.id) } });
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function insertMedia() {
  if (!post.value) {
    await save(true);
    if (!post.value) return;
  }
  mediaOpen.value = true;
}
function ready(asset: Row) {
  body.value += '\n\n[[asset:' + String(asset.id) + ']]\n\n';
  mediaOpen.value = false;
}
onMounted(async () => {
  const id = route.query.edit || route.query.draft;
  if (!id) {
    saved = snapshot();
    return;
  }
  loading.value = true;
  try {
    const p = await request<Row>(`/student/posts/${id}`);
    post.value = p;
    title.value = String(p.title);
    body.value = String(p.body);
    for (const assetId of (p.assetIds as string[] || [])) {
      if (!body.value.includes(`[[asset:${assetId}]]`)) body.value += `\n\n[[asset:${assetId}]]`;
    }
    board.value = p.boardId;
    const list = await request<Page<Row>>('/student/dictionaries/tags', {
      query: { page: 1, size: 100 },
    });
    tags.value = (p.tagIds as string[]).map((id) => ({
      id,
      name: String(list.items.find((t) => t.id === id)?.name || id),
    }));
    saved = snapshot();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <section class="post-compose">
    <div class="compose-top">
      <RouterLink to="/student/posts">‹ 返回交流社区</RouterLink
      ><span>{{ post?.state === 'DRAFT' ? '私人草稿' : '分享问题与经验' }}</span>
    </div>
    <button v-if="!post" type="button" class="button" @click="loadDrafts">继续最近草稿</button>
    <div v-if="drafts.length"><a v-for="draft in drafts" :key="String(draft.id)" :href="`/student/posts/new?draft=${draft.id}`">{{ draft.title }} · {{ draft.updatedAt }}<br /></a></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading">正在读取…</p>
    <form v-else @submit.prevent="save(false)">
      <fieldset :disabled="busy || uploading" class="compose-card">
        <input
          v-model="title"
          class="post-title"
          aria-label="帖子标题"
          placeholder="给你的分享起个标题…"
          maxlength="200"
        />
        <div class="post-meta">
          <div class="board-field">
            <label>发布板块</label
            ><ReferenceField v-model="board" field="boardId" dropdown required />
          </div>
          <div class="tag-field">
            <label for="post-tag">内容标签</label>
            <div class="tag-input">
              <span v-for="(tag, i) in tags" :key="tag.name" class="tag-chip"
                >{{ tag.name
                }}<button type="button" :aria-label="`移除${tag.name}`" @click="tags.splice(i, 1)">
                  ×
                </button></span
              ><input
                id="post-tag"
                v-model="tagQuery"
                maxlength="30"
                placeholder="搜索标签，回车新增"
                autocomplete="off"
                @input="searchTags"
                @keydown.enter.prevent="!$event.isComposing && addTag(tagQuery)"
                @keydown.escape="suggestions = []"
              />
            </div>
            <div v-if="suggestions.length" class="tag-suggestions">
              <button
                v-for="tag in suggestions"
                :key="String(tag.id)"
                type="button"
                @click="addTag(String(tag.name), String(tag.id))"
              >
                {{ tag.name }}
              </button>
            </div>
            <small>{{ tags.length }} / 5 个标签</small>
          </div>
        </div>
        <div class="media-toolbar">
          <button type="button" @click="insertMedia">插入图片 / 视频 / 音频 / 文件</button
          ><span>文件插入正文，支持 Markdown 排版</span>
        </div>
        <KnowledgeEditor v-model="body" label="帖子正文" :max-length="20000" required />
      </fieldset>
      <footer class="compose-actions">
        <span>发布后可在社区查看与回复</span
        ><button class="button" type="button" @click="preview = true">预览</button
        ><button
          v-if="!post || post.state === 'DRAFT'"
          class="button"
          type="button"
          :disabled="busy || uploading"
          @click="save(true)"
        >
          保存草稿</button
        ><button class="button primary" :disabled="busy || uploading">
          {{ busy ? '正在保存…' : '发布帖子' }}
        </button>
      </footer>
    </form>
    <CompactDialog
      v-if="mediaOpen && post"
      title="插入正文媒体"
      :busy="false"
      @back="mediaOpen = false"
      ><AssetUpload
        owner-type="FORUM"
        :owner-id="String(post.id)"
        @busy="uploading = $event"
        @ready="ready"
    /></CompactDialog>
    <CompactDialog v-if="preview" title="帖子预览" wide @back="preview = false"
      ><h2>{{ title || '未填写标题' }}</h2>
      <ForumBody :text="body" :asset-ids="assetIds"
    /></CompactDialog>
  </section>
</template>
<style scoped>
.post-compose {
  max-width: 1120px;
  margin: 0 auto;
  padding: 8px 0 100px;
}
.compose-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 20px;
  color: #8a879d;
  font-size: 12px;
}
.compose-top a {
  color: #77738b;
  text-decoration: none;
}
.compose-card {
  border: 1px solid #ebe8f3;
  border-radius: 18px;
  background: white;
  padding: 30px 38px;
  min-width: 0;
  margin: 0;
}
.post-title {
  font-size: 28px !important;
  font-weight: 650;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  width: 100%;
  padding: 8px 0 24px !important;
  height: auto !important;
}
.post-meta {
  display: flex;
  gap: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid #ebe8f3;
}
.board-field {
  width: 200px;
}
.post-meta label {
  display: block;
  font-size: 12px;
  color: #8a879d;
  margin-bottom: 7px;
}
.tag-field {
  flex: 1;
  min-width: 0;
  position: relative;
}
.tag-input {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 38px;
}
.tag-input input {
  min-width: 150px;
  width: 180px;
  border: 0 !important;
}
.tag-chip {
  background: #f1edfc;
  color: #7558c7;
  border-radius: 7px;
  padding: 4px 9px;
  font-size: 12px;
}
.tag-chip button {
  border: 0;
  background: none;
  color: inherit;
  margin-left: 6px;
}
.tag-field small {
  color: #8a879d;
  font-size: 11px;
}
.tag-suggestions {
  position: absolute;
  background: white;
  box-shadow: 0 6px 24px #27203920;
  z-index: 5;
  min-width: 200px;
  border-radius: 8px;
  padding: 6px;
}
.tag-suggestions button {
  display: block;
  border: 0;
  background: white;
  width: 100%;
  padding: 8px;
  text-align: left;
}
.media-toolbar {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 18px 0;
}
.media-toolbar button {
  border: 1px solid #ebe8f3;
  background: #faf8ff;
  border-radius: 8px;
  padding: 8px 12px;
  color: #7154dc;
}
.media-toolbar span {
  font-size: 11px;
  color: #8a879d;
}
.compose-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.compose-actions span {
  margin-right: auto;
  color: #8a879d;
  font-size: 12px;
}
.compose-card :deep(.knowledge-editor) {
  border: 0;
}
.compose-card :deep(.tiptap) {
  min-height: 360px;
}
.compose-card :deep(.editor-top) {
  background: white;
  padding-left: 0;
}
@media (max-width: 650px) {
  .compose-card {
    padding: 18px 16px;
  }
  .post-title {
    font-size: 23px !important;
  }
  .post-meta {
    flex-direction: column;
    gap: 15px;
  }
  .board-field {
    width: 100%;
  }
  .media-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .compose-actions {
    flex-wrap: wrap;
  }
  .compose-actions span {
    width: 100%;
    margin-bottom: 5px;
  }
  .tag-input input {
    max-width: 100%;
  }
  .compose-top span {
    display: none;
  }
}
</style>
