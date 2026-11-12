<script setup lang="ts">
import UserAvatar from './UserAvatar.vue';
import BrandLogo from './BrandLogo.vue';
import NotificationBell from './NotificationBell.vue';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { auth } from '../api/client';
import { managementSections, type ManagementLink } from '../config/management-navigation';
import Icon from './Icon.vue';
const props = defineProps<{
  platform: 'admin' | 'partner';
  links: ManagementLink[];
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{ logout: []; retry: [] }>();
const route = useRoute();
const opened = ref(false),
  account = ref(false),
  searchOpen = ref(false),
  query = ref('');
const sections = computed(() => managementSections(props.links));
const active = computed(() =>
  sections.value.find((section) =>
    section.links.some((link) => route.path.replace(/\/new$/, '') === link.path),
  ),
);
const current = computed(() =>
  props.links.find((link) => link.path === route.path.replace(/\/new$/, '')),
);
const searchResults = computed(() =>
  props.links.filter((link) => link.title.includes(query.value.trim())).slice(0, 10),
);
const partnerMain = computed(() =>
  ['students', 'orders', 'projects'].flatMap((key) =>
    props.links.filter((link) => link.key === key),
  ),
);
const partnerMore = computed(() =>
  props.links.filter(
    (link) => !['students', 'orders', 'projects', 'notifications'].includes(link.key),
  ),
);
const notification = computed(() => props.links.find((link) => link.key === 'notifications'));
watch(
  () => route.fullPath,
  () => {
    opened.value = false;
    account.value = false;
    searchOpen.value = false;
  },
);
function close() {
  opened.value = false;
  account.value = false;
  searchOpen.value = false;
}
</script>
<template>
  <div class="management-navigation" @keydown.esc="close">
    <button
      v-if="opened"
      class="management-overlay"
      aria-label="关闭导航"
      @click="opened = false"
    ></button>
    <aside v-if="platform === 'admin'" class="admin-sidebar" :class="{ open: opened }">
      <button class="admin-sidebar-close" aria-label="关闭管理导航" @click="opened = false">
        <Icon name="close" />
      </button>
      <RouterLink to="/admin" class="management-brand"
        ><BrandLogo /><strong>知项<em>ZHIXIANG STUDIO</em></strong
        ><small>管理端</small></RouterLink
      >
      <div class="admin-workspace-label">
        <Icon name="grid" />
        <div><strong>知项运营空间</strong><small>运营工作区</small></div>
      </div>
      <nav aria-label="管理后台主导航">
        <section>
          <h3>工作空间</h3>
          <RouterLink
            to="/admin"
            :class="{ active: ['/admin', '/admin/dashboard'].includes(route.path) }"
            ><Icon name="grid" />数据总览</RouterLink
          >
        </section>
        <p v-if="loading" class="nav-state" role="status">正在加载导航…</p>
        <p v-if="error" class="nav-state" role="alert">
          导航加载失败 <button @click="emit('retry')">重试</button>
        </p>
        <section v-for="group in ['工作空间', '内容与用户', '运营与系统']" :key="group">
          <h3 v-if="group !== '工作空间' && sections.some((s) => s.group === group)">
            {{ group }}
          </h3>
          <RouterLink
            v-for="section in sections.filter((s) => s.group === group)"
            :key="section.key"
            :to="section.links[0]!.path"
            :class="{ active: active?.key === section.key }"
            ><Icon :name="section.icon" /><span>{{ section.title }}</span></RouterLink
          >
        </section>
        <p v-if="!loading && !error && !links.length" class="nav-state">
          暂无可用导航，请联系管理员。
        </p>
      </nav>
      <div class="admin-sidebar-note">
        <Icon name="sparkles" />
        <div>一个更从容的工作台<small>连接项目、内容和每一位用户</small></div>
      </div>
      <div class="admin-sidebar-footer">
        <RouterLink to="/admin/profile" aria-label="修改个人资料"
          ><UserAvatar
            variant="admin"
            :index="auth.user?.avatarIndex"
            :asset-id="auth.user?.avatarAssetId"
            :size="40"
        /></RouterLink>
        <div>
          <strong>{{ auth.user?.displayName }}</strong
          ><small><RouterLink to="/admin/profile">修改个人资料</RouterLink></small>
        </div>
        <button aria-label="退出登录" @click="emit('logout')"><Icon name="logout" /></button>
      </div>
    </aside>
    <header class="management-topbar" :class="platform + '-topbar'">
      <div class="management-topbar-inner">
        <button
          class="management-menu-button"
          :aria-expanded="opened"
          aria-label="展开平台导航"
          @click="opened = !opened"
        >
          <Icon name="menu" />
        </button>
        <template v-if="platform === 'admin'">
          <div class="management-breadcrumb">
            <span>知项管理后台</span><Icon name="right" /><strong>{{
              active?.title || '数据总览'
            }}</strong>
          </div>
          <div
            class="management-search"
            @focusout="
              (event) => {
                if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node))
                  searchOpen = false;
              }
            "
          >
            <Icon name="search" /><input
              v-model="query"
              aria-label="搜索管理功能"
              placeholder="搜索订单、用户、配置入口…"
              @focus="searchOpen = true"
            />
            <div v-if="searchOpen" class="management-search-results">
              <RouterLink v-for="link in searchResults" :key="link.path" :to="link.path"
                ><Icon :name="link.icon" />{{ link.title }}<Icon name="right"
              /></RouterLink>
              <p v-if="!searchResults.length">没有匹配的可用功能</p>
            </div>
          </div>
        </template>
        <template v-else>
          <RouterLink to="/partner" class="management-brand"
            ><BrandLogo /><strong>知项</strong><small>中介协作</small></RouterLink
          >
          <nav class="partner-primary" :class="{ open: opened }" aria-label="中介主导航">
            <RouterLink
              to="/partner"
              :class="{ active: ['/partner', '/partner/dashboard'].includes(route.path) }"
              >工作概览</RouterLink
            ><RouterLink
              v-for="link in partnerMain"
              :key="link.key"
              :to="link.path"
              active-class="active"
              >{{ link.key === 'students' ? '我的学生' : link.title }}</RouterLink
            >
          </nav>
        </template>
        <div class="management-actions">
          <RouterLink
            v-if="notification"
            :to="notification.path"
            class="management-icon-button"
            aria-label="消息通知"
            ><NotificationBell
          /></RouterLink>
          <button class="management-account" :aria-expanded="account" @click="account = !account">
            <span class="management-avatar">{{ auth.user?.displayName?.slice(0, 1) }}</span
            ><span>{{ auth.user?.displayName }}</span
            ><Icon name="down" />
          </button>
          <div v-if="account" class="management-account-menu">
            <RouterLink
              v-for="link in platform === 'partner' ? partnerMore : []"
              :key="link.key"
              :to="link.path"
              ><Icon :name="link.icon" />{{ link.title }}</RouterLink
            ><button @click="emit('logout')"><Icon name="logout" />退出登录</button>
          </div>
        </div>
      </div>
    </header>
    <nav
      v-if="platform === 'admin' && active && active.links.length > 1"
      class="admin-section-tabs"
      aria-label="当前栏目页签"
    >
      <RouterLink
        v-for="link in active.links"
        :key="link.path"
        :to="link.path"
        :class="{ active: route.path === link.path || route.path.startsWith(link.path + '/') }"
        ><Icon :name="link.icon" />{{ link.title }}</RouterLink
      >
    </nav>
    <p v-if="platform === 'partner' && error" class="management-nav-error error" role="alert">
      导航加载失败 <button class="button" @click="emit('retry')">重试</button>
    </p>
  </div>
</template>
