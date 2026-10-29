<script setup lang="ts">
import AppSelect from '../components/AppSelect.vue';
import { onBeforeUnmount, ref } from 'vue';
import { request, errorText } from '../api/client';
import type { Page, Row } from '../types/api';
import KnowledgeDetail from '../components/KnowledgeDetail.vue';
const query = ref(''),
  mode = ref('KEYWORD'),
  type = ref(''),
  page = ref(1),
  total = ref(0),
  items = ref<Row[]>([]),
  detail = ref<Row | null>(null),
  error = ref(''),
  busy = ref(false),
  searched = ref(false);
let searchGeneration = 0,
  detailGeneration = 0;
onBeforeUnmount(() => {
  searchGeneration++;
  detailGeneration++;
});
async function search() {
  const current = ++searchGeneration;
  detailGeneration++;
  detail.value = null;
  busy.value = true;
  error.value = '';
  // 新查询和权限重查尚未成功，旧命中不能冒充当前结果。
  items.value = [];
  total.value = 0;
  searched.value = false;
  try {
    const data = await request<Page<Row>>('/student/knowledge-search', {
      query: {
        q: query.value,
        mode: mode.value,
        contentType: type.value,
        page: page.value,
        size: 20,
      },
    });
    if (current !== searchGeneration) return;
    items.value = data.items;
    total.value = data.total;
    searched.value = true;
  } catch (e) {
    if (current === searchGeneration) error.value = errorText(e);
  } finally {
    if (current === searchGeneration) busy.value = false;
  }
}
async function open(hit: Row) {
  const current = ++detailGeneration;
  error.value = '';
  try {
    const result = await request<Row>(`/student/knowledge/${hit.contentId}`);
    if (current === detailGeneration) detail.value = result;
  } catch (e) {
    if (current === detailGeneration) error.value = errorText(e);
  }
}
</script>
<template>
  <section>
    <h1>检索知识资料</h1>
    <p class="muted">搜索文档、视频和项目知识。仅检索当前有权访问的已发布内容。</p>
    <form
      class="search-form"
      @submit.prevent="
        page = 1;
        search();
      "
    >
      <input
        v-model="query"
        maxlength="100"
        required
        placeholder="输入知识点、问题或报错关键词"
        aria-label="知识检索关键词"
      /><AppSelect v-model="mode" aria-label="检索方式">
        <option value="KEYWORD">关键词检索</option>
        <option value="SEMANTIC">语义检索</option></AppSelect
      ><AppSelect v-model="type" aria-label="内容类型">
        <option value="">全部资料</option>
        <option value="MARKDOWN">知识文章</option>
        <option value="DOCUMENT">文档资料</option>
        <option value="VIDEO">视频录屏</option></AppSelect
      ><button class="button primary" :disabled="busy">搜索</button>
    </form>
    <p v-if="mode === 'SEMANTIC'" class="notice">
      语义检索需要平台配置嵌入模型；服务不可用时会明确提示，不会伪装为语义结果。
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" class="muted">正在检索…</p>
    <article
      v-for="item in items"
      :key="String(item.contentId) + String(item.versionId)"
      class="search-result"
    >
      <h2>{{ item.title }}</h2>
      <p>{{ item.snippet }}</p>
      <button class="button" @click="open(item)">查看资料</button
      ><RouterLink
        class="button primary"
        :to="{
          path: '/student/chat',
          query: { source: String(item.versionId), title: String(item.title) },
        }"
        >引用此资料提问</RouterLink
      >
    </article>
    <p v-if="searched && !items.length" class="empty">没有找到可访问的相关资料，请调整关键词。</p>
    <div v-if="searched" class="pagination">
      <span>共{{ total }}条结果</span
      ><button
        class="button"
        :disabled="page === 1 || busy"
        @click="
          page--;
          search();
        "
      >
        上一页</button
      ><span>第{{ page }}页</span
      ><button
        class="button"
        :disabled="page * 20 >= total || busy"
        @click="
          page++;
          search();
        "
      >
        下一页
      </button>
    </div>
    <div v-if="detail" class="modal-backdrop">
      <section
        v-dialog="() => (detail = null)"
        class="modal search-detail"
        role="dialog"
        aria-modal="true"
        aria-label="知识资料"
      >
        <h2>{{ detail.title }}</h2>
        <KnowledgeDetail :content="detail" /><button class="button" @click="detail = null">
          关闭
        </button>
      </section>
    </div>
  </section>
</template>
<style scoped>
.search-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.search-form input {
  flex: 1;
  min-width: 200px;
}
.search-result {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}
.search-result h2 {
  font-size: 20px;
  margin-top: 0;
}
.search-result p {
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
}
.search-result button {
  margin-right: 12px;
}
.search-detail {
  padding: 28px;
  overflow: auto;
}
</style>
