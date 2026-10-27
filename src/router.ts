import { createRouter, createWebHistory } from 'vue-router';
import AccountEntryView from './views/AccountEntryView.vue';
import LoginView from './views/LoginView.vue';
import WorkspaceView from './views/WorkspaceView.vue';
import { auth, bootstrap } from './api/client';
import type { Platform } from './types/api';
const entry = ['admin', 'student', 'partner'].includes(import.meta.env.VITE_PLATFORM)
  ? import.meta.env.VITE_PLATFORM
  : 'student';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/:platform(student)/register',
      component: AccountEntryView,
      meta: { entry: 'register', public: true },
    },
    {
      path: '/:platform(admin|student|partner)/reset',
      component: AccountEntryView,
      meta: { entry: 'reset', public: true },
    },
    {
      path: '/:platform(admin|partner)/activate',
      component: AccountEntryView,
      meta: { entry: 'activate', public: true },
    },
    { path: '/activate', redirect: (to) => ({ path: `/${entry}/activate`, hash: to.hash }) },
    { path: '/', redirect: `/${entry}/login` },
    { path: '/:platform(admin|student|partner)/login', component: LoginView },
    {
      path: '/:platform(admin|student|partner)/:resource?',
      component: WorkspaceView,
    },
    { path: '/:pathMatch(.*)*', redirect: `/${entry}/login` },
  ],
});
router.beforeEach(async (to) => {
  const platform = to.params.platform as Platform | undefined;
  if (platform && platform !== entry) return `/${entry}/login`;
  if (!platform || to.meta.public || to.path.endsWith('/login')) return;
  await bootstrap(platform);
  if (!auth.user) return `/${platform}/login`;
});
