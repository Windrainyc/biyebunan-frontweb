<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { auth, request, errorText } from '../api/client';
import AppSelect from './AppSelect.vue';
import { writeAttempt } from '../api/attempt';
import type { Page } from '../types/api';
interface Announcement {
  id: string;
  title: string;
  body: string;
  kind: string;
  audience: string;
  createdAt: string;
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
}
interface Recipient {
  id: string;
  displayName: string;
  platform: string;
  phoneMasked: string;
}
const rows = ref<Announcement[]>([]),
  total = ref(0),
  page = ref(1),
  q = ref(''),
  busy = ref(false),
  error = ref('');
const composing = ref(false),
  detail = ref<Announcement | null>(null),
  title = ref(''),
  body = ref(''),
  kind = ref('ANNOUNCEMENT'),
  audience = ref('SELECTED');
const users = ref<Recipient[]>([]),
  userTotal = ref(0),
  userPage = ref(1),
  search = ref(''),
  platform = ref(''),
  selected = ref<Record<string, Recipient>>({}),
  loadingUsers = ref(false),
  sending = ref(false),
  sendError = ref(''),
  userError = ref('');
let generation = 0,
  userGeneration = 0,
  disposed = false,
  attempt = writeAttempt();
async function load() {
  const g = ++generation;
  busy.value = true;
  error.value = '';
  try {
    const p = await request<Page<Announcement>>('/admin/announcements', {
      query: { page: page.value, size: 20, q: q.value },
    });
    if (g === generation) {
      rows.value = p.items;
      total.value = p.total;
    }
  } catch (e) {
    if (g === generation) error.value = errorText(e);
  } finally {
    if (g === generation) busy.value = false;
  }
}
async function loadUsers() {
  const g = ++userGeneration;
  loadingUsers.value = true;
  userError.value = '';
  users.value = [];
  try {
    const p = await request<Page<Recipient>>('/admin/announcements/recipients', {
      query: {
        page: userPage.value,
        size: 20,
        q: search.value,
        platform: platform.value || undefined,
      },
    });
    if (g === userGeneration) {
      users.value = p.items;
      userTotal.value = p.total;
    }
  } catch (e) {
    if (g === userGeneration) userError.value = errorText(e);
  } finally {
    if (g === userGeneration) loadingUsers.value = false;
  }
}
function open() {
  title.value = '';
  body.value = '';
  kind.value = 'ANNOUNCEMENT';
  audience.value = 'SELECTED';
  selected.value = {};
  sendError.value = '';
  attempt = writeAttempt();
  composing.value = true;
  userPage.value = 1;
  search.value = '';
  platform.value = '';
  loadUsers();
}
function toggle(u: Recipient) {
  if (selected.value[u.id]) delete selected.value[u.id];
  else if (Object.keys(selected.value).length < 200) selected.value[u.id] = u;
}
async function publish() {
  if (sending.value) return;
  if (audience.value === 'SELECTED' && !Object.keys(selected.value).length) {
    sendError.value = '请至少选择一位接收用户';
    return;
  }
  const data = {
    title: title.value.trim(),
    body: body.value.trim(),
    kind: kind.value,
    audience: audience.value,
    recipientIds: audience.value === 'ALL' ? [] : Object.keys(selected.value).sort(),
  };
  sending.value = true;
  sendError.value = '';
  try {
    const result = await request<Announcement>('/admin/announcements', {
      method: 'POST',
      body: data,
      key: attempt(data),
    });
    if (disposed) return;
    composing.value = false;
    detail.value = result;
    page.value = 1;
    await load();
  } catch (e) {
    if (!disposed) sendError.value = errorText(e);
  } finally {
    sending.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  userGeneration++;
});
</script>
<template>
  <section class="ann-manager">
    <header>
      <div>
        <h2>公告与消息发送</h2>
        <p class="muted">发布后进入接收用户的消息中心，可查看送达与已读统计。</p>
      </div>
      <button
        v-if="auth.permissions.includes('announcements:write')"
        class="button primary"
        @click="open"
      >
        发布公告 / 提醒
      </button>
    </header>
    <form
      class="ann-filter"
      @submit.prevent="
        page = 1;
        load();
      "
    >
      <input
        v-model="q"
        placeholder="搜索公告标题"
        aria-label="搜索公告标题"
        maxlength="100"
      /><button class="button" :disabled="busy">查询</button
      ><button type="button" class="button" :disabled="busy" @click="load">刷新统计</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="ann-table">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>类型 / 范围</th>
            <th>接收 / 送达 / 已读</th>
            <th>发布时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.title }}</td>
            <td>
              {{ r.kind === 'ANNOUNCEMENT' ? '公告' : '提醒' }} ·
              {{ r.audience === 'ALL' ? '全部用户' : '指定用户' }}
            </td>
            <td>{{ r.recipientCount }} / {{ r.deliveredCount }} / {{ r.readCount }}</td>
            <td>{{ new Date(r.createdAt).toLocaleString('zh-CN') }}</td>
            <td><button class="button" @click="detail = r">查看</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!rows.length && !busy && !error" class="muted">尚未发布公告或提醒</p>
    <div class="pagination">
      <span>共 {{ total }} 条</span
      ><button
        class="button"
        :disabled="page === 1 || busy"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>{{ page }}</span
      ><button
        class="button"
        :disabled="page * 20 >= total || busy"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
    <div v-if="composing" class="ann-overlay" @keydown.esc="!sending && (composing = false)">
      <section
        v-dialog="
          () => {
            if (!sending) composing = false;
          }
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="ann-title"
        class="ann-dialog"
      >
        <header>
          <h2 id="ann-title">发布公告 / 提醒</h2>
          <button class="button" :disabled="sending" @click="composing = false">关闭</button>
        </header>
        <form @submit.prevent="publish">
          <fieldset :disabled="sending">
            <div class="ann-fields">
              <label
                >消息类型<AppSelect :disabled="sending" v-model="kind">
                  <option value="ANNOUNCEMENT">公告通知</option>
                  <option value="REMINDER">消息提醒</option>
                </AppSelect></label
              ><label
                >接收范围<AppSelect :disabled="sending" v-model="audience">
                  <option value="SELECTED">指定用户</option>
                  <option value="ALL">全部启用用户</option>
                </AppSelect></label
              >
            </div>
            <label
              >标题<input
                v-model="title"
                required
                maxlength="200"
                placeholder="请输入清晰的消息标题" /></label
            ><label
              >正文<textarea
                v-model="body"
                required
                maxlength="10000"
                rows="6"
                placeholder="填写公告或提醒内容，支持换行"
              />
            </label>
            <p class="muted">{{ body.length }} / 10000 字 · 发布后内容不可修改</p>
            <div v-if="audience === 'ALL'" class="ann-notice">
              将发送给发布时全部启用的学生、中介及管理员，之后注册的用户不包含在本次发送中。
            </div>
            <section v-else class="ann-recipients">
              <h3>
                接收用户 <small>已选 {{ Object.keys(selected).length }} / 200</small>
              </h3>
              <div class="ann-filter">
                <input
                  v-model="search"
                  placeholder="姓名或脱敏手机号"
                  aria-label="搜索接收用户"
                  maxlength="100"
                  @keydown.enter.prevent="
                    userPage = 1;
                    loadUsers();
                  "
                /><AppSelect
                  :disabled="sending"
                  v-model="platform"
                  aria-label="用户平台"
                  @change="
                    userPage = 1;
                    loadUsers();
                  "
                >
                  <option value="">全部平台</option>
                  <option value="student">学生</option>
                  <option value="partner">中介</option>
                  <option value="admin">管理员</option></AppSelect
                ><button
                  type="button"
                  class="button"
                  @click="
                    userPage = 1;
                    loadUsers();
                  "
                >
                  查询用户
                </button>
              </div>
              <div class="ann-chips">
                <button v-for="u in selected" :key="u.id" type="button" @click="toggle(u)">
                  {{ u.displayName }} ×
                </button>
              </div>
              <p v-if="userError" class="error" role="alert">
                {{ userError }}
                <button type="button" class="button" @click="loadUsers">重试</button>
              </p>
              <p v-if="loadingUsers">正在查询用户…</p>
              <div class="ann-users">
                <label v-for="u in users" :key="u.id"
                  ><input
                    type="checkbox"
                    :checked="!!selected[u.id]"
                    :disabled="!selected[u.id] && Object.keys(selected).length >= 200"
                    @change="toggle(u)"
                  /><span
                    >{{ u.displayName
                    }}<small
                      >{{
                        u.platform === 'student'
                          ? '学生'
                          : u.platform === 'partner'
                            ? '中介'
                            : '管理员'
                      }}
                      · {{ u.phoneMasked }}</small
                    ></span
                  ></label
                >
              </div>
              <p v-if="!loadingUsers && !userError && !users.length" class="muted">
                没有匹配的启用用户
              </p>
              <div class="pagination">
                <button
                  type="button"
                  class="button"
                  :disabled="userPage === 1 || loadingUsers"
                  @click="
                    userPage--;
                    loadUsers();
                  "
                >
                  上一页</button
                ><span>第 {{ userPage }} 页 · 共 {{ userTotal }} 人</span
                ><button
                  type="button"
                  class="button"
                  :disabled="userPage * 20 >= userTotal || loadingUsers"
                  @click="
                    userPage++;
                    loadUsers();
                  "
                >
                  下一页
                </button>
              </div>
            </section>
          </fieldset>
          <p v-if="sendError" class="error" role="alert">{{ sendError }}</p>
          <footer>
            <button type="button" class="button" :disabled="sending" @click="composing = false">
              取消</button
            ><button
              class="button primary"
              :disabled="
                sending ||
                !title.trim() ||
                !body.trim() ||
                (audience === 'SELECTED' && !Object.keys(selected).length)
              "
            >
              {{ sending ? '正在发布…' : '确认发布并发送' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
    <div v-if="detail" class="ann-overlay" @keydown.esc="detail = null">
      <section
        v-dialog="() => (detail = null)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ann-detail-title"
        class="ann-dialog"
      >
        <header>
          <h2 id="ann-detail-title">{{ detail.title }}</h2>
          <button class="button" @click="detail = null">关闭</button>
        </header>
        <p class="muted">
          {{ detail.audience === 'ALL' ? '全部用户' : '指定用户' }} · 接收
          {{ detail.recipientCount }} 人 · 已送达 {{ detail.deliveredCount }} 人 · 已读
          {{ detail.readCount }} 人
        </p>
        <p class="ann-body">{{ detail.body }}</p>
      </section>
    </div>
  </section>
</template>
<style scoped>
.ann-manager {
  margin: 24px 0;
  padding: 24px;
  background: #fff;
  border: 1px solid #e4e9f2;
  border-radius: 14px;
}
.ann-manager header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.ann-manager h2 {
  font-size: 18px;
}
.ann-filter {
  display: flex;
  gap: 10px;
  margin: 16px 0;
  align-items: center;
  flex-wrap: wrap;
}
.ann-filter input {
  flex: 1;
  min-width: 160px;
}
.ann-table {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid #eef1f6;
  font-size: 13px;
}
th {
  color: #68778c;
  background: #f7f9fc;
}
td:first-child {
  min-width: 180px;
  overflow-wrap: anywhere;
}
.ann-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #15243b55;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ann-dialog {
  background: white;
  border-radius: 18px;
  padding: 24px;
  width: min(760px, 100%);
  max-height: 90dvh;
  overflow: auto;
  box-shadow: 0 24px 80px #1c315533;
}
.ann-dialog h2 {
  overflow-wrap: anywhere;
}
.ann-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.ann-dialog label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
  font-size: 13px;
}
.ann-dialog textarea {
  resize: vertical;
  width: 100%;
  min-height: 140px;
}
.ann-notice {
  background: #eef6ff;
  border: 1px solid #d3e7ff;
  padding: 16px;
  border-radius: 10px;
  line-height: 1.7;
}
.ann-users {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-height: 240px;
  overflow: auto;
  gap: 8px;
}
.ann-users label {
  flex-direction: row;
  align-items: center;
  margin: 0;
  border: 1px solid #e5eaf2;
  border-radius: 9px;
  padding: 10px;
}
.ann-users input {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.ann-users small {
  display: block;
  color: #8791a1;
  margin-top: 4px;
}
.ann-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ann-chips button {
  background: #eef5ff;
  color: #4673aa;
  border: 0;
  border-radius: 6px;
  padding: 6px 10px;
}
.ann-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.9;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
@media (max-width: 600px) {
  .ann-overlay {
    padding: 10px;
  }
  .ann-dialog {
    padding: 16px;
  }
  .ann-fields,
  .ann-users {
    grid-template-columns: 1fr;
  }
  .ann-manager header {
    align-items: flex-start;
    flex-direction: column;
  }
  .ann-manager {
    padding: 16px;
  }
}
</style>
