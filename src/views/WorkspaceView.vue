<script setup lang="ts">
import NotificationBell from '../components/NotificationBell.vue';
import { computed, ref, defineAsyncComponent, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, logout, errorText } from '../api/client';
import { resources } from '../config/resources';
import { loadNavigation, navigationLinks } from '../api/navigation';
import { operation } from '../config/contract';
import { utilityNavigation } from '../config/navigation-access';
import ManagementNavigation from '../components/ManagementNavigation.vue';
import { managementSections } from '../config/management-navigation';
import { useNavigationState } from '../composables/useNavigationState';
import PageLoading from '../components/PageLoading.vue';
import PageLoadError from '../components/PageLoadError.vue';
import type { Component } from 'vue';
function page(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: PageLoading,
    delay: 150,
    errorComponent: PageLoadError,
    timeout: 30000,
  });
}
const ManagementDashboard = page(() => import('./ManagementDashboard.vue'));
const DashboardView = page(() => import('./DashboardView.vue'));
const KnowledgeSearchView = page(() => import('./KnowledgeSearchView.vue'));
const ExportView = page(() => import('./ExportView.vue'));
const ChatAuditView = page(() => import('./ChatAuditView.vue'));
const ProfileView = page(() => import('./ProfileView.vue'));
const OrderBindingView = page(() => import('./OrderBindingView.vue'));
const NotificationsView = page(() => import('./NotificationsView.vue'));
const ActivityView = page(() => import('./ActivityView.vue'));
const StatisticsView = page(() => import('./StatisticsView.vue'));
const ChatView = page(() => import('./ChatView.vue'));
const MaterialBrowser = page(() => import('../components/MaterialBrowser.vue'));
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
const navigationState = useNavigationState(
  () => `${platform.value}:${auth.user?.id || ''}`,
  loadNavigation,
  errorText,
);
const { navigation, error: navigationError, refresh: refreshNavigation } = navigationState;
watch(() => [route.fullPath, auth.user?.id], refreshNavigation, { immediate: true });
onMounted(() => window.addEventListener('focus', refreshNavigation));
onUnmounted(() => {
  navigationState.dispose();
  window.removeEventListener('focus', refreshNavigation);
});
const utilityLinks = computed(() => utilityNavigation(platform.value, auth.permissions));
const knownPaths = computed(
  () =>
    new Set([
      ...entries.value.map((r) => `/${platform.value}/${r.key}`),
      ...utilityLinks.value.map((entry) => entry.path),
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
const managementLinks = computed(() => {
  const candidates = [
    ...entries.value.map((entry) => ({ ...entry, path: `/${platform.value}/${entry.key}` })),
    ...utilityLinks.value,
  ];
  return navigation.value?.configured === false
    ? candidates
    : candidates.filter((entry) => configuredLinks.value.some((link) => link.path === entry.path));
});
const managementSection = computed(() =>
  managementSections(managementLinks.value).find((section) =>
    section.links.some((link) => link.path === route.path.replace(/\/new$/, '')),
  ),
);
const studentMenuOpen = ref(false);
const accountOpen = ref(false);
const studentAllowed = (key: string) =>
  navigation.value?.configured
    ? configuredLinks.value.some((entry) => entry.path === `/student/${key}`)
    : navigation.value?.configured === false && knownPaths.value.has(`/student/${key}`);
const studentPrimary = computed(() =>
  [
    { key: 'projects', title: '我的项目', icon: 'folder' },
    { key: 'chat', title: '智能答疑', icon: 'sparkles' },
    { key: 'knowledge', title: '知识库', icon: 'book' },
    { key: 'posts', title: '答疑广场', icon: 'message' },
  ].filter((entry) => studentAllowed(entry.key)),
);
const studentSecondary = computed(() =>
  [
    ...utilityLinks.value,
    ...entries.value.map((entry) => ({ ...entry, path: `/student/${entry.key}` })),
  ].filter(
    (entry) =>
      studentAllowed(entry.key) && !studentPrimary.value.some((main) => main.key === entry.key),
  ),
);
watch(
  () => route.fullPath,
  () => {
    studentMenuOpen.value = false;
    accountOpen.value = false;
  },
);
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
  <div
    class="workspace"
    :class="{
      'student-workspace': platform === 'student',
      'admin-workspace': platform === 'admin',
      'partner-workspace': platform === 'partner',
      'has-section-nav':
        platform === 'admin' && !!managementSection && managementSection.links.length > 1,
      'has-settings-nav': platform === 'admin' && managementSection?.key === 'settings',
    }"
  >
    <header v-if="platform === 'student'" class="student-header">
      <div class="student-header-inner">
        <button
          class="student-menu-button"
          aria-label="展开学生导航"
          :aria-expanded="studentMenuOpen"
          @click="studentMenuOpen = !studentMenuOpen"
        >
          <Icon name="menu" />
        </button>
        <RouterLink to="/student" class="student-brand"
          ><span>知</span><strong>知项</strong></RouterLink
        >
        <nav class="student-nav" :class="{ open: studentMenuOpen }" aria-label="学生端主导航">
          <RouterLink to="/student" exact-active-class="is-active"
            ><Icon name="grid" />工作台</RouterLink
          >
          <RouterLink
            v-for="entry in studentPrimary"
            :key="entry.key"
            :to="`/student/${entry.key}`"
            active-class="is-active"
            ><Icon :name="entry.icon" />{{ entry.title }}</RouterLink
          >
        </nav>
        <div class="student-header-actions">
          <RouterLink v-if="studentAllowed('search')" to="/student/search" aria-label="搜索知识库"
            ><Icon name="search"
          /></RouterLink>
          <RouterLink
            v-if="studentAllowed('notifications')"
            to="/student/notifications"
            aria-label="消息通知"
            ><NotificationBell
          /></RouterLink>
          <RouterLink v-if="studentAllowed('bind-order')" to="/student/bind-order" class="button"
            >绑定订单</RouterLink
          >
          <button
            class="student-profile"
            :aria-expanded="accountOpen"
            aria-label="账户菜单"
            @click="accountOpen = !accountOpen"
          >
            <span class="student-avatar">{{ auth.user?.displayName?.slice(0, 1) }}</span
            ><span class="student-profile-name"
              >{{ auth.user?.displayName }}<small>学生账户</small></span
            ><Icon name="down" />
          </button>
          <div v-if="accountOpen" class="student-account-menu">
            <RouterLink v-for="entry in studentSecondary" :key="entry.key" :to="entry.path"
              ><Icon :name="entry.icon" />{{ entry.title }}</RouterLink
            ><button @click="exit">退出登录</button>
          </div>
        </div>
      </div>
    </header>
    <ManagementNavigation
      v-if="platform !== 'student'"
      :platform="platform"
      :links="managementLinks"
      :loading="!navigation && !navigationError"
      :error="navigationError"
      @logout="exit"
      @retry="refreshNavigation"
    />
    <div class="workspace-body">
      <main class="page">
        <div id="workspace-create-page"></div>
        <p v-if="platform === 'student' && navigationError" class="error" role="alert">
          导航加载失败 <button class="button" @click="refreshNavigation">重试</button>
        </p>
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
        /><ActivityView
          v-else-if="platform === 'admin' && route.params.resource === 'activity'"
        /><StatisticsView v-else-if="route.params.resource === 'statistics'" />
        <NotificationsView v-else-if="route.params.resource === 'notifications'" />
        <ChatView
          v-else-if="platform === 'student' && route.params.resource === 'chat'"
        /><MaterialBrowser
          v-else-if="platform === 'admin' && selected?.key === 'materials'"
        /><ResourceView
          v-else-if="selected"
          :key="selected.path"
          :resource="selected"
        /><ManagementDashboard
          v-else-if="platform !== 'student'"
          :visible-paths="managementLinks.map((link) => link.path)"
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
