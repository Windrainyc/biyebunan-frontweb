<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { auth, request } from '../api/client';
import type { Page } from '../types/api';
import Icon from './Icon.vue';
const count = ref<number | null>(null);
const route = useRoute();
let generation = 0;
let controller: AbortController | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
async function refresh() {
  const current = ++generation;
  controller?.abort();
  if (!auth.user || !auth.permissions.includes(`get_${auth.platform}_notifications`)) {
    count.value = null;
    return;
  }
  controller = new AbortController();
  try {
    const result = await request<Page<unknown>>(`/${auth.platform}/notifications`, {
      query: { page: 1, size: 1, status: 'UNREAD' },
      signal: controller.signal,
    });
    if (current === generation) count.value = result.total;
  } catch {
    // 临时失败保留同一账户上次真实数量；不得以失败响应伪装未读为零。
  }
}
function visibleRefresh() {
  if (document.visibilityState === 'visible') void refresh();
}
watch(
  () => [auth.platform, auth.user?.id, auth.permissions.join('|')],
  () => {
    count.value = null;
    void refresh();
  },
  { immediate: true },
);
watch(() => route.fullPath, refresh);
onMounted(() => {
  timer = setInterval(visibleRefresh, 30000);
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  window.addEventListener('zx:notifications-changed', refresh);
});
onBeforeUnmount(() => {
  generation++;
  controller?.abort();
  clearInterval(timer);
  window.removeEventListener('focus', visibleRefresh);
  document.removeEventListener('visibilitychange', visibleRefresh);
  window.removeEventListener('zx:notifications-changed', refresh);
});
</script>
<template>
  <span
    class="notification-bell"
    :title="count === null ? '消息通知' : `消息通知，${count} 条未读`"
  >
    <Icon name="bell" />
    <span
      v-if="count !== null && count > 0"
      class="notification-badge"
      role="status"
      :aria-label="`${count} 条未读消息`"
      >{{ count > 99 ? '99+' : count }}</span
    >
  </span>
</template>
<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}
.notification-badge {
  position: absolute;
  top: -9px;
  right: -12px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: #f04452;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
  box-shadow: 0 2px 5px #f0445226;
  pointer-events: none;
}
</style>
