import { activeSeconds } from './activity-time';
import { watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { auth, request } from '../api/client';
/** 只记录路径与知识标识；无交互超过60秒、隐藏页面或失焦不计活跃时长。 */
export function useActivity() {
  const route = useRoute();
  let path = '',
    contentId: string | undefined,
    owner = '',
    seconds = 0;
  let last = Date.now(),
    interacted = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  function touch() {
    interacted = Date.now();
  }
  function tick() {
    const now = Date.now();
    seconds += activeSeconds(
      now - last,
      document.visibilityState === 'visible',
      document.hasFocus(),
      now - interacted,
    );
    last = now;
  }
  function send(force = false) {
    const value = Math.min(30, Math.floor(seconds));
    seconds = 0;
    if (!owner || owner !== auth.user?.id || !path || (!force && value === 0)) return;
    void request(`/${auth.platform}/activity`, {
      method: 'POST',
      body: { id: crypto.randomUUID(), path, contentId, seconds: value },
    }).catch(() => {});
  }
  watch(
    () => [route.fullPath, auth.user?.id],
    () => {
      tick();
      send();
      owner = auth.user?.id || '';
      path = owner && !route.path.endsWith('/login') ? route.path : '';
      contentId =
        auth.platform === 'student' &&
        route.params.resource === 'knowledge' &&
        typeof route.query.view === 'string'
          ? route.query.view
          : undefined;
      last = Date.now();
      interacted = last;
      send(true);
    },
    { immediate: true },
  );
  function visibility() {
    tick();
    if (document.hidden) send();
  }
  onMounted(() => {
    for (const event of ['pointerdown', 'keydown', 'scroll'])
      window.addEventListener(event, touch, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    let ticks = 0;
    timer = setInterval(() => {
      tick();
      if (++ticks % 6 === 0) send();
    }, 5000);
  });
  onBeforeUnmount(() => {
    tick();
    send();
    clearInterval(timer);
    for (const event of ['pointerdown', 'keydown', 'scroll'])
      window.removeEventListener(event, touch);
    document.removeEventListener('visibilitychange', visibility);
  });
}
