<script setup lang="ts">
import { computed, ref, defineAsyncComponent, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, logout, errorText } from '../api/client';
import { resources, platformNames } from '../config/resources';
import { loadNavigation, navigationLinks, type Menu } from '../api/navigation';
import { operation } from '../config/contract';
import PageLoadError from '../components/PageLoadError.vue';
import type { Component } from 'vue';
function page(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader, errorComponent: PageLoadError, timeout: 15000 });
}
const DashboardView = page(() => import('./DashboardView.vue'));
const KnowledgeSearchView = page(() => import('./KnowledgeSearchView.vue'));
const ExportView = page(() => import('./ExportView.vue'));
const ChatAuditView = page(() => import('./ChatAuditView.vue'));
const ProfileView = page(() => import('./ProfileView.vue'));
const OrderBindingView = page(() => import('./OrderBindingView.vue'));
const NotificationsView = page(() => import('./NotificationsView.vue'));
const StatisticsView = page(() => import('./StatisticsView.vue'));
const ChatView = page(() => import('./ChatView.vue'));
const ResourceView = page(() => import('./ResourceView.vue'));
import Icon from '../components/Icon.vue';
import type { Platform } from '../types/api';
const route = useRoute(),
  router = useRouter(),
  error = ref('');
const platform = computed(() => route.params.platform as Platform);
const entries = computed(() =>
  resources(platform.value).filter((r) => {
    const op = operation('GET', r.path);
    return op && (!op.permission || auth.permissions.includes(op.permission));
  }),
);
const navigation = ref<{ configured: boolean; items: Menu[] } | null>(null);
const navigationError = ref('');
let navigationGeneration = 0;
async function refreshNavigation() {
  const current = ++navigationGeneration;
  navigation.value = null;
  navigationError.value = '';
  try {
    const result = await loadNavigation();
    if (current === navigationGeneration) navigation.value = result;
  } catch (e) {
    if (current === navigationGeneration) navigationError.value = errorText(e);
  }
}
watch(() => [route.fullPath, auth.user?.id], refreshNavigation, { immediate: true });
onMounted(() => window.addEventListener('focus', refreshNavigation));
onUnmounted(() => {
  navigationGeneration++;
  window.removeEventListener('focus', refreshNavigation);
});
const knownPaths = computed(
  () =>
    new Set([
      ...entries.value.map((r) => `/${platform.value}/${r.key}`),
      ...[
        'statistics',
        'notifications',
        ...(platform.value === 'student'
          ? ['search', 'profile', 'bind-order', 'chat']
          : ['exports', ...(platform.value === 'admin' ? ['chat-audit'] : ['profile'])]),
      ].map((p) => `/${platform.value}/${p}`),
    ]),
);
const configuredLinks = computed(() =>
  navigationLinks(navigation.value?.items || [], knownPaths.value),
);
const homeEntries = computed(() =>
  navigation.value?.configured === false
    ? entries.value
    : entries.value.filter((r) =>
        configuredLinks.value.some((m) => m.path === `/${platform.value}/${r.key}`),
      ),
);
const selected = computed(() => entries.value.find((r) => r.key === route.params.resource));
const groups = computed(() => [...new Set(entries.value.map((r) => r.group))]);
async function exit() {
  try {
    await logout();
    await router.push(`/${platform.value}/login`);
  } catch (e) {
    error.value = errorText(e);
  }
}
</script>
<template>
  <div class="workspace">
    <aside class="sidebar">
      <RouterLink :to="`/${platform}`" class="logo"
        ><span>知</span><strong>{{ platformNames[platform] }}</strong></RouterLink
      >
      <nav aria-label="平台导航">
        <p v-if="navigationError" role="alert">
          导航加载失败 <button class="button" @click="refreshNavigation">重试</button>
        </p>
        <p v-else-if="!navigation" role="status">正在加载导航…</p>
        <template v-else-if="navigation.configured">
          <RouterLink
            v-for="menu in configuredLinks"
            :key="menu.id"
            :to="menu.path"
            :style="{ paddingLeft: `${12 + Math.min(menu.depth, 4) * 12}px` }"
            >{{ menu.name }}</RouterLink
          >
          <p v-if="!configuredLinks.length">暂无可用导航，请联系管理员。</p>
        </template>
        <template v-else>
          <RouterLink v-if="platform === 'student'" to="/student/search"
            ><Icon name="book" />知识检索</RouterLink
          >
          <RouterLink v-if="platform !== 'student'" :to="`/${platform}/exports`"
            ><Icon name="file" />数据导出</RouterLink
          ><RouterLink
            v-if="platform === 'admin' && auth.permissions.includes('chat:audit')"
            to="/admin/chat-audit"
            ><Icon name="shield" />答疑会话审计</RouterLink
          >
          <RouterLink v-if="platform !== 'admin'" :to="`/${platform}/profile`"
            ><Icon name="users" />我的账户</RouterLink
          >
          <RouterLink v-if="platform === 'student'" to="/student/bind-order"
            ><Icon name="bag" />绑定订单</RouterLink
          >
          <RouterLink :to="`/${platform}/statistics`"><Icon name="activity" />数据统计</RouterLink
          ><RouterLink :to="`/${platform}/notifications`"><Icon name="bell" />消息通知</RouterLink>
          <RouterLink v-if="platform === 'student'" to="/student/chat"
            ><Icon name="message" />在线答疑</RouterLink
          >
          <section v-for="group in groups" :key="group">
            <h3>{{ group }}</h3>
            <RouterLink
              v-for="entry in entries.filter((e) => e.group === group)"
              :key="entry.key"
              :to="`/${platform}/${entry.key}`"
              ><Icon :name="entry.icon" />{{ entry.title }}</RouterLink
            >
          </section>
        </template>
      </nav>
      <div class="sidebar-foot">项目答疑 · 交付协作</div>
    </aside>
    <div class="workspace-body">
      <header class="topbar">
        <span>{{ selected?.title || '工作台' }}</span>
        <div>
          <span>{{ auth.user?.displayName }}</span
          ><button class="button" @click="exit">退出登录</button>
        </div>
      </header>
      <main class="page">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <KnowledgeSearchView
          v-if="platform === 'student' && route.params.resource === 'search'"
        /><ExportView
          v-else-if="platform !== 'student' && route.params.resource === 'exports'"
        /><ChatAuditView
          v-else-if="platform === 'admin' && route.params.resource === 'chat-audit'"
        /><ProfileView
          v-else-if="platform !== 'admin' && route.params.resource === 'profile'"
        /><OrderBindingView
          v-else-if="platform === 'student' && route.params.resource === 'bind-order'"
        /><StatisticsView v-else-if="route.params.resource === 'statistics'" />
        <NotificationsView v-else-if="route.params.resource === 'notifications'" />
        <ChatView
          v-else-if="platform === 'student' && route.params.resource === 'chat'"
        /><ResourceView
          v-else-if="selected"
          :key="selected.path"
          :resource="selected"
        /><DashboardView
          v-else
          :entries="homeEntries"
          :visible-paths="
            navigation?.configured ? configuredLinks.map((m) => m.path) : [...knownPaths]
          "
        />
      </main>
    </div>
  </div>
</template>
<style scoped>
.workspace {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 248px;
  flex-shrink: 0;
  background: #132143;
  color: #c8d2e8;
  position: fixed;
  inset: 0 auto 0 0;
  overflow: auto;
  padding: 24px 16px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  text-decoration: none;
  margin-bottom: 32px;
}
.logo span {
  background: #2c4bdb;
  border-radius: 10px;
  padding: 8px 12px;
}
.logo strong {
  font-size: 16px;
}
nav h3 {
  font-size: 11px;
  color: #8393b5;
  margin: 24px 12px 10px;
}
nav a {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  color: #c8d2e8;
  text-decoration: none;
  font-size: 14px;
}
nav a:hover,
nav a.router-link-active {
  background: #2b3d65;
  color: white;
}
.sidebar-foot {
  font-size: 12px;
  color: #8393b5;
  margin: 32px 12px;
}
.workspace-body {
  margin-left: 248px;
  width: calc(100% - 248px);
}
.topbar {
  height: 76px;
  background: white;
  border-bottom: 1px solid #e4e8ef;
  padding: 0 36px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.topbar div {
  display: flex;
  gap: 18px;
  align-items: center;
}
.page {
  padding: 32px 36px;
}
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 20px;
  margin-top: 28px;
}
.entry-card {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 14px;
  padding: 24px;
  text-decoration: none;
  color: inherit;
}
.entry-card h2 {
  font-size: 19px;
}
.entry-card p {
  font-size: 13px;
  color: #718096;
  line-height: 1.8;
}
.entry-card > span {
  font-size: 13px;
  color: #2c4bdb;
}
@media (max-width: 800px) {
  .sidebar {
    width: 180px;
  }
  .workspace-body {
    margin-left: 180px;
    width: calc(100% - 180px);
  }
  .page {
    padding: 20px;
  }
  .logo strong {
    font-size: 12px;
  }
}
</style>
