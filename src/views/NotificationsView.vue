<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import Icon from '../components/Icon.vue';
import AnnouncementManager from '../components/AnnouncementManager.vue';
import { auth, request, errorText } from '../api/client';
import type { Page } from '../types/api';
import { display } from '../config/labels';
interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  announcementId?: string;
  projectId?: string;
  eventType?: string;
  targetId?: string;
}
const section = ref('inbox'),
  search = ref(''),
  status = ref('');
const selected = ref<Notification | null>(null);
const target = computed(() => {
  const n = selected.value;
  if (!n) return null;
  if (n.projectId) return { path: `/${auth.platform}/projects`, query: { view: n.projectId } };
  if (auth.platform === 'admin' && n.targetId && n.eventType?.startsWith('forum_post.'))
    return { path: '/admin/posts', query: { view: n.targetId } };
  if (auth.platform === 'admin' && n.targetId && n.eventType === 'billing.RECONCILING')
    return { path: '/admin/usage', query: { runId: n.targetId } };
  if (auth.platform === 'admin' && n.targetId && n.eventType === 'forum_discussion.REPORTED')
    return { path: '/admin/reports', query: { view: n.targetId } };
  return null;
});
async function select(item: Notification) {
  selected.value = item;
  announcement.value = null;
  detailGeneration++;
  if (item.announcementId) await showAnnouncement(item);
}
const items = ref<Notification[]>([]),
  page = ref(1),
  total = ref(0),
  error = ref(''),
  busy = ref(false),
  failed = ref(false),
  reading = ref(new Set<string>());
const announcement = ref<{ title: string; body: string } | null>(null);
let detailGeneration = 0;
async function showAnnouncement(item: Notification) {
  const g = ++detailGeneration;
  error.value = '';
  try {
    const result = await request<{ title: string; body: string }>(
      `/${auth.platform}/announcements/${item.announcementId}`,
    );
    if (disposed || g !== detailGeneration) return;
    announcement.value = result;
    await read(item);
  } catch (e) {
    if (!disposed && g === detailGeneration) error.value = errorText(e);
  }
}
let generation = 0;
let disposed = false;
async function load() {
  const current = ++generation;
  busy.value = true;
  failed.value = false;
  error.value = '';
  items.value = [];
  selected.value = null;
  announcement.value = null;
  detailGeneration++;
  total.value = 0;
  try {
    const data = await request<Page<Notification>>(`/${auth.platform}/notifications`, {
      query: {
        page: page.value,
        size: 20,
        q: search.value.trim() || undefined,
        status: status.value || undefined,
      },
    });
    if (current !== generation) return;
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === generation) {
      failed.value = true;
      error.value = errorText(e);
    }
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function read(item: Notification) {
  if (reading.value.has(item.id)) return;
  reading.value.add(item.id);
  error.value = '';
  try {
    await request(`/${auth.platform}/notifications/${item.id}/read`, { method: 'POST' });
    if (disposed) return;
    const current = items.value.find((row) => row.id === item.id);
    if (current) current.read = true;
    window.dispatchEvent(new Event('zx:notifications-changed'));
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  } finally {
    reading.value.delete(item.id);
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
</script>
<template>
  <section class="work-notifications">
    <header class="work-heading">
      <div>
        <h1>{{ auth.platform === 'admin' ? '工作通知' : '消息通知' }}</h1>
        <p class="muted">
          {{
            auth.platform === 'admin'
              ? '关注学生提交、验收反馈与需要跟进的事项。'
              : '查看与你相关的项目与服务消息。'
          }}
        </p>
      </div>
      <button class="button" :disabled="busy" @click="load"><Icon name="refresh" />刷新</button>
    </header>
    <nav class="work-tabs" aria-label="消息页面">
      <button :class="{ active: section === 'inbox' }" @click="section = 'inbox'">我的收件箱</button
      ><button
        v-if="auth.platform === 'admin' && auth.permissions.includes('announcements:read')"
        :class="{ active: section === 'publish' }"
        @click="section = 'publish'"
      >
        公告发布
      </button>
    </nav>
    <AnnouncementManager v-if="section === 'publish'" />
    <template v-else>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="work-inbox" :class="{ reading: selected }">
        <aside class="work-list">
          <form
            class="work-search"
            @submit.prevent="
              page = 1;
              load();
            "
          >
            <input
              v-model="search"
              aria-label="搜索通知"
              placeholder="搜索通知标题或摘要"
              maxlength="100"
            /><button class="button" :disabled="busy">搜索</button>
          </form>
          <div class="work-filters">
            <button
              v-for="filter in [
                { value: '', label: '全部' },
                { value: 'UNREAD', label: '未读' },
                { value: 'READ', label: '已读' },
              ]"
              :key="filter.value"
              :class="{ active: status === filter.value }"
              @click="
                status = filter.value;
                page = 1;
                load();
              "
            >
              {{ filter.label }}
            </button>
          </div>
          <div class="work-rows">
            <button
              v-for="item in items"
              :key="item.id"
              class="work-row"
              :class="{ selected: selected?.id === item.id, unread: !item.read }"
              @click="select(item)"
            >
              <strong>{{ item.title }}</strong>
              <p>{{ item.body }}</p>
              <small>{{ display(item.createdAt) }} · {{ item.read ? '已读' : '未读' }}</small>
            </button>
            <p v-if="!items.length" class="work-empty" role="status">
              {{ busy ? '正在加载…' : failed ? '加载失败，请重试' : '暂无符合条件的通知' }}
            </p>
          </div>
          <footer class="work-paging">
            <button
              class="button"
              :disabled="page === 1 || busy || failed"
              @click="
                page--;
                load();
              "
            >
              上一页</button
            ><span>{{ page }} · 共 {{ total }} 条</span
            ><button
              class="button"
              :disabled="page * 20 >= total || busy || failed"
              @click="
                page++;
                load();
              "
            >
              下一页
            </button>
          </footer>
        </aside>
        <article class="work-detail">
          <template v-if="selected"
            ><button class="button work-back" @click="selected = null">返回列表</button>
            <div class="work-detail-body">
              <span class="work-label">{{
                selected.announcementId
                  ? '公告'
                  : auth.platform === 'admin'
                    ? '业务通知'
                    : '项目与服务'
              }}</span>
              <h2>{{ announcement?.title || selected.title }}</h2>
              <small>{{ display(selected.createdAt) }}</small>
              <p>{{ announcement?.body || selected.body }}</p>
              <p v-if="selected.announcementId && !announcement" class="muted">
                公告全文加载中；失败时可重新选择此通知。
              </p>
              <p class="work-hint">通知已读不代表业务已处理，处理结果以对应业务记录为准。</p>
            </div>
            <footer>
              <RouterLink v-if="target" class="button primary" :to="target">查看业务记录</RouterLink
              ><button
                class="button"
                :disabled="selected.read || reading.has(selected.id)"
                @click="read(selected)"
              >
                {{ selected.read ? '已读' : '标记已读' }}
              </button>
            </footer></template
          >
          <p v-else class="work-empty">从左侧选择一条通知查看详情</p>
        </article>
      </div></template
    >
  </section>
</template>
<style scoped>
.work-notifications {
  max-width: 1200px;
  margin: auto;
}
.work-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.work-heading h1 {
  margin: 0 0 6px;
  font-size: 22px;
}
.work-heading p {
  margin: 0;
  font-size: 13px;
}
.work-tabs,
.work-filters {
  display: flex;
  gap: 8px;
  padding: 10px 0;
}
.work-tabs button,
.work-filters button {
  background: transparent;
  border: 0;
  padding: 8px 14px;
  cursor: pointer;
  color: #657189;
  border-radius: 6px;
}
.work-tabs .active,
.work-filters .active {
  background: #edf0ff;
  color: #4b50ba;
}
.work-inbox {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: min(680px, calc(100dvh - 230px));
  min-height: 400px;
  background: white;
  border: 1px solid #e4e7ee;
  border-radius: 10px;
  overflow: hidden;
}
.work-list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid #e4e7ee;
}
.work-search {
  display: flex;
  gap: 8px;
  padding: 16px 16px 0;
}
.work-search input {
  min-width: 0;
  flex: 1;
}
.work-filters {
  padding: 8px 12px;
}
.work-rows {
  overflow: auto;
  flex: 1;
}
.work-row {
  display: block;
  width: 100%;
  text-align: left;
  background: white;
  border: 0;
  border-bottom: 1px solid #eef0f5;
  padding: 17px 20px;
  cursor: pointer;
  color: #263249;
}
.work-row.selected {
  background: #f1f3fc;
}
.work-row strong {
  display: block;
  font-size: 14px;
  line-height: 1.6;
}
.work-row.unread strong:before {
  content: '';
  display: inline-block;
  background: #6568cd;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 7px;
}
.work-row p {
  color: #7b8799;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 6px 0;
  font-size: 12px;
}
.work-row small,
.work-detail small {
  color: #8993a5;
  font-size: 11px;
}
.work-paging {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  gap: 8px;
  font-size: 11px;
  border-top: 1px solid #eef0f5;
}
.work-paging .button {
  padding: 5px 8px;
}
.work-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.work-detail-body {
  padding: 30px;
  overflow: auto;
  flex: 1;
}
.work-detail h2 {
  font-size: 20px;
  line-height: 1.6;
  margin: 14px 0 8px;
}
.work-detail-body > p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.9;
  font-size: 14px;
  margin-top: 24px;
}
.work-detail-body .work-hint {
  font-size: 12px;
  color: #8b94a5;
  background: #f7f8fb;
  padding: 14px;
  border-radius: 6px;
}
.work-label {
  font-size: 12px;
  color: #666bb7;
  background: #f0f1fb;
  padding: 5px 8px;
  border-radius: 4px;
}
.work-detail > footer {
  padding: 16px 24px;
  display: flex;
  gap: 10px;
  border-top: 1px solid #eef0f5;
}
.work-empty {
  padding: 40px 24px;
  text-align: center;
  color: #8c96a7;
  font-size: 13px;
}
.work-back {
  display: none;
}
@media (max-width: 800px) {
  .work-inbox {
    grid-template-columns: 1fr;
    height: calc(100dvh - 245px);
  }
  .work-detail {
    display: none;
  }
  .work-inbox.reading .work-list {
    display: none;
  }
  .work-inbox.reading .work-detail {
    display: flex;
  }
  .work-back {
    display: block;
    align-self: flex-start;
    margin: 12px 16px 0;
  }
  .work-detail-body {
    padding: 20px;
  }
  .work-heading {
    align-items: flex-start;
  }
  .work-heading h1 {
    font-size: 20px;
  }
  .work-heading p {
    max-width: 230px;
  }
  .work-list {
    border-right: 0;
  }
}
</style>
