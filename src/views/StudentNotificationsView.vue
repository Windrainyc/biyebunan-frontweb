<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import type { Page } from '../types/api';
import Icon from '../components/Icon.vue';
import CompactDialog from '../components/CompactDialog.vue';
interface Message {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  announcementId?: string;
  projectId?: string;
}
const items = ref<Message[]>([]),
  selected = ref<Message | null>(null),
  fullBody = ref(''),
  query = ref(''),
  search = ref(''),
  status = ref(''),
  page = ref(1),
  total = ref(0),
  unread = ref<number | null>(null),
  loading = ref(false),
  error = ref(''),
  detailError = ref(''),
  detailLoading = ref(false),
  mobileOpen = ref(false),
  batch = ref(false),
  confirming = ref(false),
  reading = ref(new Set<string>());
let generation = 0,
  detailGeneration = 0,
  unreadGeneration = 0,
  disposed = false;
const unreadPage = computed(() => items.value.filter((x) => !x.read));
function category(x: Message) {
  return x.announcementId ? '平台公告' : x.projectId ? '项目消息' : '服务提醒';
}
function time(x: string) {
  return new Date(x).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function group(x: string) {
  const d = new Date(x),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return d >= today ? '今天' : d >= yesterday ? '昨天' : '更早';
}
async function countUnread() {
  const g = ++unreadGeneration;
  try {
    const data = await request<Page<Message>>('/student/notifications', {
      query: { page: 1, size: 1, status: 'UNREAD' },
    });
    if (!disposed && g === unreadGeneration) unread.value = data.total;
  } catch {
    if (!disposed && g === unreadGeneration) unread.value = null;
  }
}
async function load() {
  const g = ++generation;
  ++detailGeneration;
  loading.value = true;
  error.value = '';
  selected.value = null;
  mobileOpen.value = false;
  items.value = [];
  try {
    const data = await request<Page<Message>>('/student/notifications', {
      query: {
        page: page.value,
        size: 20,
        q: query.value || undefined,
        status: status.value || undefined,
      },
    });
    if (disposed || g !== generation) return;
    items.value = data.items;
    total.value = data.total;
    if (!data.items.length && page.value > 1) {
      page.value = Math.max(1, Math.ceil(data.total / 20));
      void load();
      return;
    }
  } catch (e) {
    if (!disposed && g === generation) error.value = errorText(e);
  } finally {
    if (!disposed && g === generation) loading.value = false;
  }
  void countUnread();
}
function filter(s: string) {
  status.value = s;
  page.value = 1;
  void load();
}
function find() {
  query.value = search.value.trim();
  page.value = 1;
  void load();
}
async function read(x: Message) {
  if (x.read || reading.value.has(x.id)) return;
  reading.value.add(x.id);
  try {
    await request(`/student/notifications/${x.id}/read`, { method: 'POST' });
    if (disposed) return;
    x.read = true;
    const row = items.value.find((v) => v.id === x.id);
    if (row) row.read = true;
    window.dispatchEvent(new Event('zx:notifications-changed'));
    void countUnread();
  } finally {
    reading.value.delete(x.id);
  }
}
async function open(x: Message) {
  const g = ++detailGeneration;
  selected.value = x;
  fullBody.value = x.body;
  detailError.value = '';
  mobileOpen.value = true;
  detailLoading.value = true;
  try {
    if (x.announcementId) {
      const data = await request<{ title: string; body: string }>(
        `/student/announcements/${x.announcementId}`,
      );
      if (disposed || g !== detailGeneration) return;
      fullBody.value = data.body;
    }
    if (disposed || g !== detailGeneration) return;
    await read(x);
  } catch (e) {
    if (!disposed && g === detailGeneration) detailError.value = errorText(e);
  } finally {
    if (!disposed && g === detailGeneration) detailLoading.value = false;
  }
}
async function markPage() {
  const snapshot = [...unreadPage.value];
  confirming.value = false;
  batch.value = true;
  error.value = '';
  try {
    for (const x of snapshot) {
      if (disposed) break;
      await read(x);
    }
  } catch (e) {
    error.value = `部分消息未能标记，请重试。${errorText(e)}`;
  } finally {
    batch.value = false;
  }
}
function close() {
  mobileOpen.value = false;
}
onMounted(() => void load());
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  detailGeneration++;
});
</script>
<template>
  <section class="student-inbox">
    <header class="intro">
      <div>
        <h1>消息通知</h1>
        <p>
          项目进展与平台公告，都在这里。<span v-if="unread"> {{ unread }} 条未读</span>
        </p>
      </div>
      <div class="actions">
        <button class="button plain" :disabled="loading || batch" @click="load">
          <Icon name="refresh" />刷新</button
        ><button
          class="button"
          :disabled="loading || batch || !unreadPage.length"
          @click="confirming = true"
        >
          {{ batch ? '正在标记…' : '本页已读' }}
        </button>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="inbox">
      <div class="toolbar">
        <div class="tabs">
          <button
            v-for="tab in [
              { label: '全部消息', value: '' },
              { label: '未读消息', value: 'UNREAD' },
              { label: '已读消息', value: 'READ' },
            ]"
            :key="tab.value"
            :class="{ active: status === tab.value }"
            :aria-pressed="status === tab.value"
            :disabled="batch"
            @click="filter(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
        <span>仅展示与你相关的消息</span>
      </div>
      <div class="split">
        <section class="listpane" aria-label="消息列表">
          <form class="search" @submit.prevent="find">
            <input
              v-model="search"
              maxlength="100"
              placeholder="搜索消息标题或内容"
              aria-label="搜索消息"
              :disabled="batch"
            /><button aria-label="搜索" :disabled="batch"><Icon name="search" /></button>
          </form>
          <div v-if="loading" class="empty" role="status">正在读取消息…</div>
          <div v-else-if="error && !items.length" class="empty">
            <Icon name="info" />
            <h3>消息暂时没能加载</h3>
            <p>请稍后重试，你的消息不会丢失。</p>
            <button class="button" @click="load">重新加载</button>
          </div>
          <div v-else-if="!items.length" class="empty">
            <Icon name="bell" />
            <h3>{{ status === 'UNREAD' ? '暂时没有未读消息' : '暂时没有相关消息' }}</h3>
            <p>项目进展和平台公告会显示在这里。</p>
          </div>
          <template v-for="(item, i) in items" v-else :key="item.id"
            ><div
              v-if="!i || group(item.createdAt) !== group(items[i - 1]!.createdAt)"
              class="group"
            >
              {{ group(item.createdAt) }}
            </div>
            <button
              class="message-row"
              :class="{ selected: selected?.id === item.id, unread: !item.read }"
              :aria-pressed="selected?.id === item.id"
              @click="open(item)"
            >
              <span class="type-icon"><Icon :name="item.projectId ? 'folder' : 'bell'" /></span
              ><span class="row-copy"
                ><span class="row-head"
                  ><strong>{{ item.title }}</strong
                  ><time>{{ time(item.createdAt) }}</time></span
                ><span class="preview">{{ item.body }}</span
                ><span class="row-foot"
                  >{{ category(item) }}<i v-if="!item.read" class="dot" /><span v-else
                    >已读</span
                  ></span
                ></span
              >
            </button></template
          >
          <div class="list-footer">
            <span>{{
              loading ? '正在查询…' : error && !items.length ? '总数暂不可用' : `共 ${total} 条`
            }}</span>
            <div>
              <button
                class="button"
                :disabled="page === 1 || loading || batch"
                @click="
                  page--;
                  load();
                "
              >
                上一页</button
              ><span>{{ page }}</span
              ><button
                class="button"
                :disabled="page * 20 >= total || loading || batch"
                @click="
                  page++;
                  load();
                "
              >
                下一页
              </button>
            </div>
          </div>
        </section>
        <section
          class="reader"
          :class="{ 'mobile-open': mobileOpen }"
          aria-label="消息阅读区"
          @keydown.esc="close"
        >
          <template v-if="selected"
            ><div class="reader-top">
              <button class="mobile-back" @click="close">返回消息列表</button><span>消息详情</span
              ><span>{{ selected.read ? '已读' : detailLoading ? '正在读取…' : '未读' }}</span>
            </div>
            <div class="read-body">
              <span class="label"
                ><Icon :name="selected.projectId ? 'folder' : 'bell'" />{{
                  category(selected)
                }}</span
              >
              <h2>{{ selected.title }}</h2>
              <div class="byline">
                {{ category(selected) }}<span>·</span
                >{{ new Date(selected.createdAt).toLocaleString('zh-CN') }}
              </div>
              <div v-if="detailLoading" class="detail-status" role="status">正在读取消息…</div>
              <div v-else-if="detailError" class="error" role="alert">
                {{ detailError }}<button class="button" @click="open(selected)">重试读取</button>
              </div>
              <div v-else class="message-body">{{ fullBody }}</div>
              <div v-if="selected.projectId" class="reference">
                <span class="type-icon"><Icon name="folder" /></span>
                <div><small>关联项目</small><strong>查看这条通知对应的项目与交付</strong></div>
              </div>
            </div>
            <footer class="reader-footer">
              <small>{{
                selected.read ? '已读 · 可随时在列表中回看' : '成功读取后将标记为已读'
              }}</small
              ><RouterLink
                v-if="selected.projectId"
                class="button primary"
                :to="{ path: '/student/projects', query: { view: selected.projectId } }"
                >查看关联项目</RouterLink
              ><button v-else class="button" @click="close">我知道了</button>
            </footer></template
          >
          <div v-else class="reader-placeholder">
            <Icon name="bell" />
            <h3>把重要的进展，读清楚</h3>
            <p>从左侧选择一条消息，查看完整内容。</p>
          </div>
        </section>
      </div>
    </div>
    <CompactDialog v-if="confirming" title="将本页消息标为已读？" @back="confirming = false"
      ><p>将标记当前页的 {{ unreadPage.length }} 条未读消息，其他页保持不变。</p>
      <template #footer
        ><div class="actions">
          <button class="button" @click="confirming = false">取消</button
          ><button class="button primary" @click="markPage">确认标记</button>
        </div></template
      ></CompactDialog
    >
  </section>
</template>
<style scoped>
.student-inbox {
  max-width: 1168px;
  margin: 0 auto;
  color: #202c40;
}
.intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 4px 0 24px;
}
.intro h1 {
  font-family: inherit;
  font-size: 28px;
  font-weight: 650;
  margin: 0 0 5px;
}
.intro p {
  font-size: 13px;
  color: #8590a1;
  margin: 0;
}
.intro p span {
  color: #002fa7;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.button {
  min-height: 36px;
  font-size: 12px;
}
.plain {
  border-color: transparent;
  background: transparent;
}
.inbox {
  border: 1px solid #e8ebf0;
  border-radius: 12px;
  background: white;
  overflow: hidden;
}
.toolbar {
  padding: 0 24px;
  border-bottom: 1px solid #e8ebf0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 65px;
  gap: 12px;
}
.toolbar > span {
  font-size: 11px;
  color: #96a0af;
}
.tabs {
  display: flex;
  gap: 24px;
  align-self: stretch;
}
.tabs button {
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
  color: #7a8597;
  font-size: 13px;
  position: relative;
  cursor: pointer;
}
.tabs button.active {
  color: #002fa7;
  font-weight: 600;
}
.tabs button.active:after {
  content: '';
  height: 2px;
  background: #002fa7;
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
}
.split {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  min-height: 610px;
}
.listpane {
  border-right: 1px solid #e8ebf0;
  min-width: 0;
}
.search {
  display: flex;
  align-items: center;
  margin: 18px 20px 8px;
  background: #f7f7f8;
  border: 1px solid #eef0f3;
  border-radius: 7px;
  padding: 0 11px;
}
.search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: none;
  height: 36px;
  font-size: 12px;
  box-shadow: none;
}
.search button {
  border: 0;
  background: transparent;
  color: #8590a1;
  cursor: pointer;
  padding: 4px;
}
.group {
  font-size: 11px;
  color: #929bac;
  padding: 14px 24px 7px;
}
.message-row {
  width: 100%;
  border: 0;
  border-radius: 0;
  background: white;
  padding: 18px 22px;
  display: flex;
  gap: 13px;
  text-align: left;
  position: relative;
  border-bottom: 1px solid #f2f3f6;
  min-height: 111px;
  cursor: pointer;
  color: inherit;
}
.message-row:hover {
  background: #f7f9fc;
}
.message-row.selected {
  background: #f1f5ff;
}
.message-row.selected:before {
  content: '';
  position: absolute;
  width: 3px;
  background: #002fa7;
  left: 0;
  top: 0;
  bottom: 0;
}
.type-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f4f5f8;
  color: #8993a5;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.unread .type-icon {
  background: #e8efff;
  color: #002fa7;
}
.row-copy {
  min-width: 0;
  flex: 1;
}
.row-head {
  display: flex;
  align-items: center;
  gap: 7px;
}
.row-head strong {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.unread strong {
  font-weight: 650;
}
.row-head time {
  font-size: 10px;
  color: #96a0af;
  white-space: nowrap;
}
.preview {
  font-size: 12px;
  line-height: 1.7;
  color: #8a94a3;
  margin: 5px 0 7px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.row-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7d899b;
  font-size: 10px;
}
.row-foot > span,
.row-foot .dot {
  margin-left: auto;
}
.dot {
  width: 6px;
  height: 6px;
  background: #002fa7;
  border-radius: 50%;
  display: block;
}
.list-footer {
  padding: 18px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #9aa3b1;
  gap: 10px;
}
.list-footer > div {
  display: flex;
  gap: 8px;
  align-items: center;
}
.list-footer .button {
  font-size: 10px;
  padding: 3px 5px;
  min-height: 25px;
}
.reader {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.reader-top {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-bottom: 1px solid #f2f3f6;
  color: #99a2b0;
  font-size: 11px;
}
.read-body {
  padding: 33px 38px;
  flex: 1;
}
.label {
  color: #002fa7;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.read-body h2 {
  font-family: inherit;
  font-size: 23px;
  line-height: 1.5;
  margin: 13px 0 12px;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.byline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #9aa3b1;
  font-size: 11px;
}
.message-body {
  font-size: 14px;
  line-height: 1.95;
  color: #606d81;
  margin-top: 32px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-status {
  padding: 30px 0;
  color: #8590a1;
}
.reference {
  margin-top: 26px;
  padding: 17px 18px;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 13px;
}
.reference small {
  display: block;
  font-size: 10px;
  color: #98a1af;
  margin-bottom: 3px;
}
.reference strong {
  font-size: 12px;
  font-weight: 500;
}
.reader-footer {
  padding: 19px 32px;
  border-top: 1px solid #e8ebf0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}
.reader-footer small {
  font-size: 11px;
  color: #a0a8b5;
}
.mobile-back {
  display: none;
}
.empty {
  padding: 65px 20px;
  text-align: center;
  color: #9aa3b1;
}
.empty h3,
.reader-placeholder h3 {
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.6;
  color: #626e81;
}
.empty p,
.reader-placeholder p {
  font-size: 12px;
}
.reader-placeholder {
  margin: auto;
  padding: 35px;
  text-align: center;
  color: #9aa3b1;
}
.error .button {
  margin: 10px;
}
.primary {
  background: #edf2ff;
  color: #002fa7;
  border-color: #dde6ff;
}
.student-inbox button:focus-visible {
  outline: 2px solid #002fa7;
  outline-offset: -2px;
}
@media (max-width: 1100px) {
  .split {
    grid-template-columns: 340px minmax(0, 1fr);
  }
  .read-body {
    padding: 26px;
  }
  .reader-top,
  .reader-footer {
    padding-left: 24px;
    padding-right: 24px;
  }
}
@media (max-width: 700px) {
  .intro {
    align-items: flex-start;
    gap: 10px;
  }
  .intro h1 {
    font-size: 24px;
  }
  .intro p {
    font-size: 11px;
  }
  .actions {
    gap: 4px;
  }
  .actions .button {
    padding: 6px;
    font-size: 11px;
    white-space: nowrap;
  }
  .toolbar {
    padding: 0 16px;
    min-height: 57px;
  }
  .toolbar > span {
    display: none;
  }
  .tabs {
    gap: 24px;
  }
  .tabs button {
    font-size: 12px;
  }
  .split {
    display: block;
    min-height: 510px;
  }
  .listpane {
    border: 0;
  }
  .message-row {
    padding: 16px;
  }
  .reader {
    display: none;
  }
  .search {
    margin: 16px 15px 5px;
  }
  .group {
    padding-left: 18px;
  }
  .reader.mobile-open {
    display: flex;
    position: fixed;
    inset: 0;
    background: white;
    z-index: 100;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .reader-top {
    height: 60px;
    min-height: 60px;
    position: sticky;
    top: 0;
    background: white;
    padding: 0 18px;
    z-index: 2;
  }
  .mobile-back {
    display: block;
    color: #002fa7;
    border: 0;
    background: none;
    padding: 5px 0;
    font-size: 13px;
    cursor: pointer;
  }
  .reader-top > span:first-of-type {
    display: none;
  }
  .read-body {
    padding: 27px 24px;
  }
  .reader-footer {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 18px 24px;
    min-height: 75px;
  }
  .reader-footer small {
    max-width: 120px;
  }
  .reader-footer .button {
    white-space: nowrap;
  }
  .list-footer {
    padding: 18px 16px;
  }
}
</style>
