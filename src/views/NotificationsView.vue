<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
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
  total.value = 0;
  try {
    const data = await request<Page<Notification>>(`/${auth.platform}/notifications`, {
      query: { page: page.value, size: 20 },
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
  <section class="notifications-page">
    <header class="notifications-heading">
      <div>
        <p class="eyebrow">消息中心</p>
        <h1>消息通知</h1>
        <p class="muted">查看与你相关的项目与服务消息。</p>
      </div>
      <button class="button" :disabled="busy" @click="load">
        <Icon name="refresh" />
        {{ failed ? '重试查询' : '刷新消息' }}
      </button>
    </header>
    <AnnouncementManager
      v-if="auth.platform === 'admin' && auth.permissions.includes('announcements:read')"
    />
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <article
      v-for="item in items"
      :key="item.id"
      class="notification"
      :class="{ unread: !item.read }"
    >
      <span class="notification-icon"><Icon name="bell" /></span>
      <div class="notification-content">
        <div class="notification-title">
          <h2>{{ item.title }}</h2>
          <span>{{ display(item.createdAt) }}</span>
        </div>
        <p>{{ item.body }}</p>
        <button v-if="item.announcementId" class="button" @click="showAnnouncement(item)">
          查看详情
        </button>
        <button
          v-if="!item.read"
          class="button"
          :disabled="reading.has(item.id)"
          @click="read(item)"
        >
          标记已读</button
        ><span v-else class="notification-read"><Icon name="check" />已读</span>
      </div>
    </article>
    <div v-if="!items.length" class="notification-empty" role="status">
      <Icon :name="failed ? 'info' : 'bell'" />
      <h2>{{ busy ? '正在读取消息…' : failed ? '消息加载失败' : '暂时没有消息' }}</h2>
      <p>
        {{
          failed ? '请点击重试查询，恢复后会显示当前消息。' : '项目和服务的最新通知会出现在这里。'
        }}
      </p>
    </div>
    <div class="pagination">
      <span>{{ busy ? '正在查询…' : failed ? '总数暂不可用' : `共${total}条` }}</span
      ><button
        class="button"
        :disabled="page === 1 || busy || failed"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页</span
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
    </div>
    <div v-if="announcement" class="announcement-overlay" @keydown.esc="announcement = null">
      <section
        v-dialog="() => (announcement = null)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-heading"
      >
        <button class="button" @click="announcement = null">关闭</button>
        <h2 id="announcement-heading">{{ announcement.title }}</h2>
        <p>{{ announcement.body }}</p>
      </section>
    </div>
  </section>
</template>
<style scoped>
.announcement-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #15243b55;
  display: grid;
  place-items: center;
  padding: 20px;
}
.announcement-overlay section {
  background: white;
  border-radius: 16px;
  padding: 28px;
  width: min(700px, 100%);
  max-height: 85dvh;
  overflow: auto;
}
.announcement-overlay p {
  white-space: pre-wrap;
  line-height: 1.9;
  overflow-wrap: anywhere;
}

.notifications-page {
  max-width: 1100px;
  margin: 0 auto;
}
.notifications-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
}
.notifications-heading h1 {
  margin: 10px 0;
}
.notifications-heading .button {
  flex-shrink: 0;
}
.notification {
  display: flex;
  gap: 20px;
  background: white;
  border: 1px solid #e4e9f2;
  border-radius: 14px;
  padding: 24px;
  margin-top: 14px;
}
.notification.unread {
  border-left: 3px solid #4e62d9;
}
.notification-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #f0f3fa;
  color: #8b97ac;
}
.unread .notification-icon {
  color: #4d5dcc;
  background: #edeffc;
}
.notification-content {
  min-width: 0;
  flex: 1;
}
.notification-title {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: baseline;
}
.notification h2 {
  font-size: 16px;
  margin: 0;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.notification-title span {
  flex-shrink: 0;
  font-size: 11px;
  color: #8a96a9;
}
.notification p {
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #66748b;
  margin: 12px 0;
}
.notification .button {
  padding: 6px 10px;
  min-height: 30px;
  font-size: 12px;
}
.notification-read {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: #9aa5b5;
  font-size: 12px;
}
.notification-empty {
  padding: 64px 24px;
  text-align: center;
  border: 1px dashed #dfe5ef;
  border-radius: 16px;
  background: #ffffff80;
  color: #9ba6b6;
}
.notification-empty > .ali-icon {
  font-size: 30px;
}
.notification-empty h2 {
  font: 600 22px var(--serif);
  color: #5f718d;
  margin: 18px 0 10px;
}
.notification-empty p {
  font-size: 12px;
}
@media (max-width: 650px) {
  .notifications-heading {
    align-items: flex-start;
  }
  .notification {
    padding: 18px;
    gap: 12px;
  }
  .notification-title {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
