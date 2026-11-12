<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import type { Row, Page } from '../types/api';
import UserAvatar from '../components/UserAvatar.vue';
import Icon from '../components/Icon.vue';
import ForumBody from '../components/ForumBody.vue';
import ForumDetail from '../components/ForumDetail.vue';
import RecordActions from '../components/RecordActions.vue';
import CompactDialog from '../components/CompactDialog.vue';
import { studentPostActions } from '../config/forum-actions';
interface Community {
  activeUsers: Row[];
  hotPosts: Row[];
  keywords: { name: string; count: number }[];
}
const route = useRoute(),
  router = useRouter();
const rows = ref<Row[]>([]),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  search = ref('');
const boards = ref<Row[]>([]),
  boardTotal = ref(0),
  boardPage = ref(0),
  boardError = ref(''),
  boardLoading = ref(false);
const community = ref<Community | null>(null),
  communityError = ref(''),
  communityLoading = ref(false);
const post = ref<Row | null>(null),
  deleting = ref(false),
  busy = ref(false),
  writeError = ref('');
const attempt = writeAttempt();
let generation = 0,
  disposed = false;
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const scope = computed(() => String(route.query.scope || 'all'));
const mode = computed(() => String(route.query.mode || 'latest'));
const board = computed(() => String(route.query.boardId || ''));
const selectedId = computed(() => String(route.query.view || ''));
const maxWord = computed(() =>
  Math.max(1, ...(community.value?.keywords.map((w) => w.count) || [])),
);
const canCreate = computed(() => auth.permissions.includes('post_student_posts'));
function navigate(values: Record<string, string | number | undefined>) {
  void router.push({ path: '/student/posts', query: { ...route.query, ...values } });
}
function filter(values: Record<string, string | number | undefined>) {
  navigate({ ...values, page: undefined, view: undefined });
}
function open(id: unknown) {
  navigate({ view: String(id) });
  window.scrollTo(0, 0);
}
function back() {
  navigate({ view: undefined });
}
function create() {
  void router.push({ path: '/student/posts/new', query: route.query });
}
function date(value: unknown) {
  return value
    ? new Date(String(value)).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}
function excerpt(value: unknown) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`>\[\]]/g, ' ')
    .slice(0, 220);
}
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  post.value = null;
  rows.value = [];
  search.value = String(route.query.q || '');
  try {
    if (selectedId.value) {
      const data = await request<Row>(`/student/posts/${selectedId.value}`);
      if (current === generation) post.value = data;
    } else {
      const data = await request<Page<Row>>('/student/forum/feed', {
        query: {
          page: page.value,
          size: 12,
          q: search.value || undefined,
          boardId: board.value || undefined,
          scope: scope.value,
          mode: mode.value,
        },
      });
      if (current === generation) {
        rows.value = data.items;
        total.value = data.total;
        if (page.value > 1 && !data.items.length && data.total > 0)
          navigate({ page: Math.ceil(data.total / 12) });
      }
    }
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function loadBoards() {
  if (boardLoading.value) return;
  boardLoading.value = true;
  boardError.value = '';
  try {
    const data = await request<Page<Row>>('/student/dictionaries/forum-boards', {
      query: { page: boardPage.value + 1, size: 30 },
    });
    if (!disposed) {
      boards.value = [...boards.value, ...data.items];
      boardTotal.value = data.total;
      boardPage.value++;
    }
  } catch (e) {
    if (!disposed) boardError.value = errorText(e);
  } finally {
    if (!disposed) boardLoading.value = false;
  }
}
async function loadCommunity() {
  communityLoading.value = true;
  communityError.value = '';
  try {
    const data = await request<Community>('/student/forum/community');
    if (!disposed) community.value = data;
  } catch (e) {
    if (!disposed) communityError.value = errorText(e);
  } finally {
    if (!disposed) communityLoading.value = false;
  }
}
async function changed() {
  await Promise.all([load(), loadCommunity()]);
}
async function remove() {
  if (!post.value || busy.value) return;
  busy.value = true;
  writeError.value = '';
  try {
    await request(`/student/posts/${post.value.id}`, {
      method: 'DELETE',
      version: post.value.version,
      key: attempt({ id: post.value.id, version: post.value.version }),
    });
    deleting.value = false;
    back();
    void loadCommunity();
  } catch (e) {
    writeError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
watch(
  () => route.fullPath,
  () => {
    void load();
  },
  { immediate: true },
);
void loadBoards();
void loadCommunity();
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
</script>
<template>
  <section class="forum-page">
    <template v-if="!selectedId">
      <header class="forum-intro">
        <div>
          <p class="eyebrow">分享卡点，也分享灵光一现</p>
          <h1>交流广场</h1>
          <p>分享一个想法，解决一个问题，一起把项目做好。</p>
        </div>
        <button v-if="canCreate" class="button primary" @click="create">发布讨论</button>
      </header>
      <section class="forum-reference-banner">
        <span><Icon name="message" /> 想法在这里碰面</span>
        <h2>你的一个小发现，<br />可能刚好帮到另一位同学。</h2>
        <p>分享方法，交换经验。每一个认真回应，都让项目向前一点。</p>
        <div class="forum-banner-art" aria-hidden="true">
          <span><Icon name="sparkles" />这个问题，你是怎么解决的？<i></i><i></i></span
          ><span><Icon name="right" />一起拆开看看。<i></i></span>
        </div>
      </section>
      <div class="forum-grid">
        <section class="discussion-panel" :aria-busy="loading">
          <div class="forum-tools">
            <details class="forum-filter-menu">
              <summary>板块与我的讨论 <Icon name="down" /></summary>
              <aside class="topic-nav">
                <small>发现话题</small
                ><button
                  :class="{ selected: !board && scope === 'all' }"
                  @click="filter({ boardId: undefined, scope: 'all' })"
                >
                  全部话题</button
                ><button
                  v-for="b in boards"
                  :key="String(b.id)"
                  :class="{ selected: board === b.id }"
                  @click="filter({ boardId: String(b.id), scope: 'all' })"
                >
                  {{ b.name }}
                </button>
                <p v-if="boardError" class="error">
                  {{ boardError }}<button @click="loadBoards">重试</button>
                </p>
                <button
                  v-if="boards.length < boardTotal"
                  :disabled="boardLoading"
                  @click="loadBoards"
                >
                  加载更多板块
                </button>
                <p v-if="boardLoading" role="status">加载板块…</p>
                <small class="personal">我的空间</small
                ><button
                  :class="{ selected: scope === 'mine' }"
                  @click="filter({ scope: 'mine', boardId: undefined })"
                >
                  我的发布</button
                ><button
                  :class="{ selected: scope === 'participated' }"
                  @click="filter({ scope: 'participated', boardId: undefined })"
                >
                  我的参与
                </button>
              </aside>
            </details>
            <form class="forum-search" @submit.prevent="filter({ q: search.trim() || undefined })">
              <input
                v-model="search"
                maxlength="100"
                aria-label="搜索讨论"
                placeholder="搜索问题、关键词或技术主题"
              /><button type="submit" aria-label="搜索"><Icon name="search" /></button>
            </form>
            <div class="forum-tabs">
              <button
                v-for="tab in [
                  { key: 'latest', name: '最新讨论' },
                  { key: 'hot', name: '热门讨论' },
                  { key: 'unanswered', name: '等待回复' },
                ]"
                :key="tab.key"
                :class="{ selected: mode === tab.key }"
                @click="filter({ mode: tab.key })"
              >
                {{ tab.name }}
              </button>
            </div>
          </div>
          <p v-if="loading" class="forum-empty" role="status">正在读取讨论…</p>
          <div v-else-if="error" class="forum-empty error" role="alert">
            {{ error }}<button class="button" @click="load">重试</button>
          </div>
          <div v-else-if="!rows.length" class="forum-empty">
            <h2>还没有相关讨论</h2>
            <p>换个关键词或板块试试，也可以发起新的讨论。</p>
            <button
              class="button"
              @click="
                filter({ q: undefined, boardId: undefined, scope: undefined, mode: undefined })
              "
            >
              查看全部话题
            </button>
          </div>
          <article v-for="row in rows" :key="String(row.id)" class="discussion">
            <div class="discussion-by">
              <UserAvatar :index="Number(row.avatarIndex) || 0" :size="32" /><span
                >{{ row.authorName }} · {{ date(row.createdAt) }}</span
              ><span class="board-name">{{ row.boardName }}</span>
            </div>
            <h2>
              <button @click="open(row.id)">{{ row.title }}</button>
            </h2>
            <p class="discussion-excerpt">{{ excerpt(row.body) }}</p>
            <div class="discussion-meta">
              <button @click="open(row.id)">
                {{ row.state === 'PENDING' ? '待审核 · 仅自己可见' : '查看讨论' }}
                <Icon name="right" /></button
              ><button @click="open(row.id)">{{ row.replyCount }} 回复</button>
            </div>
          </article>
          <footer v-if="!loading && !error" class="forum-pagination">
            <span>共 {{ total }} 篇讨论</span>
            <div>
              <button :disabled="page <= 1" @click="navigate({ page: page - 1 })">上一页</button
              ><span>{{ page }}</span
              ><button :disabled="page * 12 >= total" @click="navigate({ page: page + 1 })">
                下一页
              </button>
            </div>
          </footer>
        </section>
        <aside class="community-column">
          <section class="community-card welcome">
            <small>一起聊聊</small>
            <h2>第一次演示项目，<br />怎样讲清楚你的思路？</h2>
            <p>从「功能介绍」到「使用场景」，分享你的表达小技巧。</p>
            <button v-if="canCreate" class="text-button" @click="create">
              加入这场讨论 <Icon name="right" />
            </button>
          </section>
          <details class="community-card community-live">
            <summary>社区热度与关键词</summary>
            <p v-if="communityLoading" role="status">正在读取社区数据…</p>
            <p v-if="communityError" class="error" role="alert">
              {{ communityError }}<button @click="loadCommunity">重试</button>
            </p>
            <template v-if="community && !communityError"
              ><h3>本周活跃同学</h3>
              <div
                v-if="community.activeUsers.length"
                class="people-window"
                tabindex="0"
                aria-label="本周活跃同学，悬停或聚焦暂停滚动"
              >
                <div
                  class="people-track"
                  :class="{ moving: community.activeUsers.length > 4 }"
                  :style="{ '--travel': `${community.activeUsers.length * 50}px` }"
                >
                  <div
                    v-for="(u, i) in community.activeUsers.length > 4
                      ? [...community.activeUsers, ...community.activeUsers]
                      : community.activeUsers"
                    :key="i"
                    class="active-person"
                    :aria-hidden="i >= community.activeUsers.length ? true : undefined"
                    :title="`${u.displayName} · ${u.contributions} 次公开发帖或回复`"
                  >
                    <UserAvatar :index="Number(u.avatarIndex) || 0" :size="36" /><span>{{
                      u.displayName
                    }}</span>
                  </div>
                </div>
              </div>
              <p v-else>近七天暂无公开互动</p>
              <div class="community-heading">
                <h3>热门讨论</h3>
                <small title="近七天可见回复数×3＋独立回复人数×5">热度指数</small>
              </div>
              <button
                v-for="(hot, i) in community.hotPosts"
                :key="String(hot.id)"
                class="hot-post"
                @click="open(hot.id)"
              >
                <b>{{ String(i + 1).padStart(2, '0') }}</b
                ><span
                  >{{ hot.title
                  }}<i
                    ><em
                      :style="{
                        width: `${(Number(hot.heat) / Math.max(1, ...community.hotPosts.map((h) => Number(h.heat)))) * 100}%`,
                      }" /></i></span
                ><small>{{ hot.heat }}</small>
              </button>
              <p v-if="!community.hotPosts.length">近七天暂无热门讨论</p>
              <div class="community-heading"><h3>大家在聊什么</h3></div>
              <div v-if="community.keywords.length" class="keyword-cloud">
                <button
                  v-for="(word, i) in community.keywords"
                  :key="word.name"
                  :class="`word-${i % 3}`"
                  :style="{ fontSize: `${12 + Math.sqrt(word.count / maxWord) * 12}px` }"
                  :title="`${word.count} 篇帖子`"
                  @click="
                    filter({ q: word.name, boardId: undefined, scope: 'all', mode: 'latest' })
                  "
                >
                  {{ word.name }}
                </button>
              </div>
              <p v-else>暂无话题标签</p>
              <p class="community-note">近 7 天公开帖子标签与板块</p></template
            >
          </details>
          <section class="community-card">
            <h2>让问题更容易被解答</h2>
            <p>1. 用标题说明具体问题</p>
            <p>2. 写清环境、步骤和报错</p>
            <p>3. 隐去密码与个人隐私</p>
          </section>
        </aside>
      </div>
    </template>
    <template v-else
      ><button class="text-button forum-back" @click="back">返回交流广场</button>
      <p v-if="loading" role="status">正在读取讨论…</p>
      <p v-else-if="error" class="error" role="alert">
        {{ error }}<button class="button" @click="load">重试</button>
      </p>
      <article v-else-if="post" class="forum-article">
        <h1>{{ post.title }}</h1>
        <p class="article-meta">
          {{ date(post.createdAt) }} ·
          {{
            post.state === 'LOCKED' ? '已锁定' : post.state === 'PENDING' ? '待审核' : '公开讨论'
          }}
        </p>
        <ForumBody :text="String(post.body || '')" :asset-ids="post.assetIds" />
        <div
          v-if="
            studentPostActions(post, auth.user?.id).edit ||
            studentPostActions(post, auth.user?.id).remove
          "
          class="article-actions"
        >
          <button
            v-if="
              studentPostActions(post, auth.user?.id).edit &&
              auth.permissions.includes('put_student_posts_id')
            "
            class="text-button"
            @click="navigate({ edit: String(post.id), view: undefined })"
          >
            编辑帖子</button
          ><button
            v-if="
              studentPostActions(post, auth.user?.id).remove &&
              auth.permissions.includes('delete_student_posts_id')
            "
            class="text-button"
            @click="deleting = true"
          >
            删除帖子
          </button>
        </div>
        <RecordActions
          compact
          class="post-quick-actions"
          resource-key="posts"
          :record="post"
          @changed="changed"
        /><ForumDetail :post="post" @changed="changed" @replied="loadCommunity" /></article
    ></template>
    <CompactDialog v-if="deleting" title="删除帖子" :busy="busy" @back="deleting = false"
      ><p>确认删除这篇帖子？删除后不再向其他同学展示。</p>
      <p v-if="writeError" class="error" role="alert">{{ writeError }}</p>
      <template #footer
        ><div class="footer-actions">
          <button class="button" :disabled="busy" @click="deleting = false">取消</button
          ><button class="button primary" :disabled="busy" @click="remove">确认删除</button>
        </div></template
      ></CompactDialog
    >
  </section>
</template>
<style scoped>
.forum-page {
  max-width: 1280px;
  margin: 0 auto;
  color: #202c40;
}
.forum-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0 28px;
  gap: 20px;
}
.forum-intro h1 {
  font-size: 28px;
  margin: 0 0 8px;
}
.forum-intro p {
  font-size: 13px;
  color: #8390a3;
  margin: 0;
}
.forum-intro > .button {
  flex: none;
}
.forum-grid {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 250px;
  gap: 24px;
  align-items: start;
}
.topic-nav {
  display: grid;
  gap: 5px;
}
.topic-nav > small {
  font-size: 11px;
  color: #8d99ab;
  padding: 8px 14px;
}
.topic-nav > small.personal {
  border-top: 1px solid #e9edf3;
  margin-top: 20px;
  padding-top: 25px;
}
.topic-nav > button {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 11px 14px;
  color: #65728a;
  border-radius: 7px;
  overflow-wrap: anywhere;
}
.topic-nav > button.selected {
  background: #eaf1ff;
  color: #294ca6;
}
.discussion-panel,
.community-card,
.forum-article {
  background: #fff;
  border: 1px solid #e9edf3;
  border-radius: 12px;
  min-width: 0;
}
.forum-tools {
  padding: 20px 22px 0;
}
.forum-search {
  position: relative;
  margin-bottom: 16px;
}
.forum-search input {
  width: 100%;
  height: 44px;
  padding: 10px 48px 10px 12px;
  border: 1px solid #e5eaf1;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 13px;
}
.forum-search button {
  position: absolute;
  right: 5px;
  top: 5px;
  width: 34px;
  height: 34px;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #62748e;
}
.forum-search button:hover {
  background: #e9f0ff;
  color: #002fa7;
}
.forum-tabs {
  display: flex;
  gap: 25px;
  border-bottom: 1px solid #e9edf3;
}
.forum-tabs button {
  padding: 8px 0 12px;
  border: 0;
  background: transparent;
  color: #8a96a8;
  font-size: 13px;
  border-bottom: 2px solid transparent;
}
.forum-tabs button.selected {
  color: #002fa7;
  border-bottom-color: #002fa7;
}
.discussion {
  padding: 22px;
  border-bottom: 1px solid #e9edf3;
}
.discussion-by {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #8a95a6;
  flex-wrap: wrap;
}
.board-name {
  margin-left: auto;
}
.discussion h2 {
  font-size: 18px;
  margin: 12px 0 8px;
  line-height: 1.5;
}
.discussion h2 button {
  font: inherit;
  font-weight: 600;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  overflow-wrap: anywhere;
  color: #26354c;
}
.discussion h2 button:hover {
  color: #002fa7;
}
.discussion-excerpt {
  font-size: 13px;
  color: #8590a1;
  line-height: 1.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.discussion-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  font-size: 11px;
  color: #8b97a8;
}
.discussion-meta > span {
  background: #f2f5fa;
  padding: 2px 7px;
  border-radius: 4px;
}
.discussion-meta button {
  font: inherit;
  border: 0;
  background: transparent;
  color: inherit;
}
.forum-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  gap: 8px;
  font-size: 11px;
  color: #8995a7;
}
.forum-pagination > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.forum-pagination button {
  border: 1px solid #e9edf3;
  background: white;
  border-radius: 5px;
  padding: 5px 8px;
  color: #65758c;
  font-size: 11px;
}
.forum-pagination button:disabled {
  opacity: 0.4;
}
.forum-empty {
  padding: 55px 22px;
  text-align: center;
  color: #8b97a8;
  font-size: 13px;
}
.forum-empty h2 {
  font-size: 17px;
}
.community-card {
  padding: 22px;
  margin-bottom: 18px;
}
.community-card h2 {
  font-size: 15px;
  margin: 0 0 20px;
}
.community-card h3 {
  font-size: 12px;
  font-weight: 500;
  color: #718098;
  margin: 0 0 14px;
}
.community-card p {
  font-size: 12px;
  color: #8b97a8;
  line-height: 1.8;
}
.welcome {
  background: #edf3ff;
  border-color: #e1eaff;
}
.welcome h2 {
  color: #294ca6;
  font-size: 18px;
}
.welcome .button {
  width: 100%;
  margin-top: 12px;
}
.community-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 1px solid #e9edf3;
  padding-top: 20px;
  margin-top: 22px;
}
.community-heading small {
  font-size: 10px;
  color: #9aa5b6;
}
.people-window {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 93%, transparent);
}
.people-track {
  display: flex;
  gap: 14px;
  width: max-content;
}
.people-track.moving {
  animation: members 30s linear infinite;
}
.people-window:hover .people-track,
.people-window:focus .people-track {
  animation-play-state: paused;
}
.active-person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 36px;
  flex: none;
}
.active-person > span {
  font-size: 10px;
  color: #8b97a8;
  max-width: 46px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
@keyframes members {
  to {
    transform: translateX(calc(-1 * var(--travel)));
  }
}
.hot-post {
  display: flex;
  width: 100%;
  gap: 8px;
  border: 0;
  padding: 8px 0;
  background: transparent;
  text-align: left;
  color: #65758e;
}
.hot-post b {
  font-size: 11px;
  color: #8199bf;
  font-weight: 500;
}
.hot-post > span {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
.hot-post small {
  font-size: 10px;
  color: #8395b0;
}
.hot-post i {
  display: block;
  height: 3px;
  background: #f0f3f8;
  margin-top: 7px;
}
.hot-post em {
  display: block;
  height: 3px;
  background: #a9bfe3;
}
.keyword-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  justify-content: center;
  align-items: center;
  min-height: 95px;
}
.keyword-cloud button {
  border: 0;
  background: transparent;
  padding: 0;
  line-height: 1.4;
  max-width: 100%;
  overflow-wrap: anywhere;
  font-weight: 500;
}
.keyword-cloud .word-0 {
  color: #7c9fda;
}
.keyword-cloud .word-1 {
  color: #9baec9;
}
.keyword-cloud .word-2 {
  color: #8bb5ac;
}
.keyword-cloud button:hover {
  text-decoration: underline;
}
.community-card .community-note {
  font-size: 10px;
  color: #a0aaba;
  margin-top: 20px;
}
.forum-back {
  margin-bottom: 22px;
}
.forum-article {
  max-width: 920px;
  margin: auto;
  padding: 32px 40px;
}
.forum-article h1 {
  font-size: 26px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.forum-article :deep(.post-quick-actions .action-buttons .button) {
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 4px 0;
  color: #9290a3;
}
.forum-article :deep(.post-quick-actions) {
  margin: 12px 0 20px;
}
.article-meta {
  color: #8b97a8;
  font-size: 12px;
}
.article-actions {
  display: flex;
  gap: 15px;
  margin: 24px 0;
}
.forum-article :deep(.markdown-content) {
  overflow-wrap: anywhere;
}
@media (prefers-reduced-motion: reduce) {
  .people-track.moving {
    animation: none;
  }
}
@media (max-width: 1100px) {
  .forum-grid {
    grid-template-columns: 140px minmax(0, 1fr);
  }
  .community-column {
    grid-column: 2;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .community-column .community-card {
    margin: 0;
  }
  .community-column .welcome {
    display: none;
  }
}
@media (max-width: 650px) {
  .forum-grid {
    display: block;
  }
  .forum-intro h1 {
    font-size: 24px;
  }
  .forum-intro {
    align-items: flex-start;
  }
  .forum-intro p {
    font-size: 12px;
  }
  .topic-nav {
    display: flex;
    overflow-x: auto;
    margin-bottom: 16px;
  }
  .topic-nav > button {
    white-space: nowrap;
    flex: none;
    padding: 8px 12px;
    font-size: 12px;
  }
  .topic-nav > small {
    display: none;
  }
  .forum-tools {
    padding: 16px 16px 0;
  }
  .discussion {
    padding: 18px 16px;
  }
  .discussion h2 {
    font-size: 17px;
  }
  .forum-pagination {
    padding: 16px;
  }
  .forum-tabs {
    gap: 20px;
  }
  .community-column {
    display: block;
    margin-top: 18px;
  }
  .community-column .community-card {
    margin-bottom: 16px;
  }
  .forum-article {
    padding: 22px 18px;
  }
  .forum-article h1 {
    font-size: 23px;
  }
}
</style>
