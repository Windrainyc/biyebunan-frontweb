<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { ApiError, auth, request, errorText } from '../api/client';
import { display } from '../config/labels';
import { writeAttempt } from '../api/attempt';
import type { Row, User } from '../types/api';
import ReferenceField from '../components/ReferenceField.vue';
import StatusBadge from '../components/StatusBadge.vue';
import Icon from '../components/Icon.vue';
const profile = ref<Row | null>(null),
  name = ref(''),
  school = ref(''),
  major = ref('');
const error = ref(''),
  notice = ref(''),
  busy = ref(false),
  conflict = ref(false);
const profileLoading = ref(false),
  profileError = ref('');
const quota = ref<Row | null>(null),
  quotaLoading = ref(false),
  quotaError = ref('');
const membership = ref<Row | null>(null),
  membershipLoading = ref(false),
  membershipError = ref('');
const attempt = writeAttempt();
let disposed = false;
async function loadProfile() {
  if (profileLoading.value || busy.value) return;
  profileLoading.value = true;
  profileError.value = '';
  profile.value = null;
  try {
    const value = await request<Row>(`/${auth.platform}/me`);
    if (disposed) return;
    profile.value = value;
    name.value = String(value.displayName || '');
    school.value = String(value.schoolId || '');
    major.value = String(value.majorId || '');
    conflict.value = false;
    error.value = '';
  } catch (e) {
    if (!disposed) profileError.value = errorText(e);
  } finally {
    if (!disposed) profileLoading.value = false;
  }
}
async function loadQuota() {
  if (quotaLoading.value) return;
  quotaLoading.value = true;
  quotaError.value = '';
  quota.value = null;
  try {
    const value = await request<Row>('/student/quota');
    if (!disposed) quota.value = value;
  } catch (e) {
    if (!disposed) quotaError.value = errorText(e);
  } finally {
    if (!disposed) quotaLoading.value = false;
  }
}
async function loadMembership() {
  if (membershipLoading.value) return;
  membershipLoading.value = true;
  membershipError.value = '';
  membership.value = null;
  try {
    const value = await request<Row>('/student/membership');
    if (!disposed) membership.value = value;
  } catch (e) {
    if (!disposed && !(e instanceof ApiError && e.status === 404))
      membershipError.value = errorText(e);
  } finally {
    if (!disposed) membershipLoading.value = false;
  }
}
async function save() {
  if (busy.value || !profile.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  conflict.value = false;
  try {
    const body = { displayName: name.value.trim(), schoolId: school.value, majorId: major.value };
    const updated = await request<User>(`/${auth.platform}/me`, {
      method: 'PUT',
      body,
      version: profile.value.version,
      key: attempt(body),
    });
    if (disposed) return;
    profile.value = updated as unknown as Row;
    auth.user = updated;
    notice.value = '资料已更新';
  } catch (e) {
    if (!disposed) {
      error.value = errorText(e);
      conflict.value = e instanceof ApiError && e.status === 412;
    }
  } finally {
    if (!disposed) busy.value = false;
  }
}
onMounted(() => {
  void loadProfile();
  if (auth.platform === 'student') {
    void loadQuota();
    void loadMembership();
  }
});
onBeforeUnmount(() => {
  disposed = true;
});
</script>
<template>
  <section class="account-page">
    <header class="account-heading">
      <p class="eyebrow">账户与身份</p>
      <h1>我的账户</h1>
      <p class="muted">
        {{
          auth.platform === 'student'
            ? '管理个人资料，查看会员状态与可用额度。'
            : '完善协作资料，保持院校与专业信息准确。'
        }}
      </p>
    </header>
    <div class="account-layout">
      <aside class="account-aside">
        <article class="account-identity">
          <span class="account-avatar">{{ (auth.user?.displayName || '知').slice(0, 1) }}</span>
          <h2>{{ auth.user?.displayName }}</h2>
          <p>{{ auth.platform === 'student' ? '学生账户' : '项目中介' }}</p>
          <StatusBadge :value="auth.user?.status" />
          <dl>
            <dt>绑定手机号</dt>
            <dd>{{ auth.user?.phoneMasked || '—' }}</dd>
          </dl>
          <p class="account-hint"><Icon name="shield" />身份和访问范围由平台管理。</p>
        </article>
        <article v-if="auth.platform === 'student'" class="membership-card">
          <h2>当前会员</h2>
          <p v-if="membershipLoading" class="muted" role="status">正在读取会员状态…</p>
          <p v-else-if="membershipError" class="error" role="alert">
            {{ membershipError }}
            <button class="button" @click="loadMembership">重试读取会员</button>
          </p>
          <template v-else-if="membership"
            ><StatusBadge :value="membership.state" />
            <p>
              {{ display(membership.startsAt) }}<br />至 {{ display(membership.expiresAt) }}
            </p></template
          >
          <p v-else class="muted">当前没有有效会员</p>
          <p class="account-hint">会员有效期与额度分别管理，可用量以额度账户为准。</p>
        </article>
      </aside>
      <div class="account-main">
        <section v-if="auth.platform === 'student'" class="account-quota-section">
          <div class="section-heading">
            <h2>额度账户</h2>
            <button class="text-button" :disabled="quotaLoading" @click="loadQuota">
              <Icon name="refresh" />刷新额度
            </button>
          </div>
          <p v-if="quotaLoading" class="muted" role="status">正在读取额度…</p>
          <p v-else-if="quotaError" class="error" role="alert">
            {{ quotaError }} <button class="button" @click="loadQuota">重试读取额度</button>
          </p>
          <div v-else-if="quota" class="quota">
            <article>
              <span>可用词元</span><strong>{{ quota.availableTokens }}</strong>
            </article>
            <article>
              <span>预占词元</span><strong>{{ quota.reservedTokens }}</strong>
            </article>
            <article>
              <span>可用金额（元）</span><strong>{{ quota.availableAmount }}</strong>
            </article>
            <article>
              <span>预占金额（元）</span><strong>{{ quota.reservedAmount }}</strong>
            </article>
          </div>
        </section>
        <section class="profile-card">
          <h2>个人资料</h2>
          <p class="account-hint">手机号用于登录和身份核验，在此仅作脱敏展示。</p>
          <p v-if="profileLoading" class="muted" role="status">正在读取个人资料…</p>
          <p v-if="profileError" class="error" role="alert">
            {{ profileError }} <button class="button" @click="loadProfile">重试读取资料</button>
          </p>
          <form v-if="profile" @submit.prevent="save">
            <fieldset :disabled="busy" class="profile-fields">
              <label>姓名 <input v-model="name" maxlength="200" required /></label>
              <label>手机号 <input :value="String(profile.phoneMasked)" readonly /></label>
              <div>
                <p>院校 <span aria-hidden="true" class="danger">*</span></p>
                <ReferenceField
                  v-model="school"
                  field="schoolId"
                  required
                  aria-label="院校"
                  @update:model-value="major = ''"
                />
              </div>
              <div>
                <p>专业 <span aria-hidden="true" class="danger">*</span></p>
                <ReferenceField
                  v-if="school"
                  v-model="major"
                  field="majorId"
                  :filters="{ schoolId: school }"
                  required
                  aria-label="专业"
                />
                <p v-else class="profile-select-prompt">请先选择院校，再选择对应专业。</p>
              </div>
            </fieldset>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <p v-if="notice" class="success" role="status">{{ notice }}</p>
            <p v-if="conflict" class="notice">
              资料已被更新，请先重新读取后再编辑；重新读取会替换未保存的输入。<button
                type="button"
                class="button"
                @click="loadProfile"
              >
                重新读取资料
              </button>
            </p>
            <footer>
              <span>资料变更将保存到当前账户</span
              ><button
                class="button primary"
                :disabled="busy || conflict || !school || !major || !name.trim()"
              >
                {{ busy ? '保存中…' : '保存资料' }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </div>
  </section>
</template>
<style scoped>
.account-page {
  max-width: 1240px;
  margin: 0 auto;
}
.account-heading {
  margin-bottom: 28px;
}
.account-heading h1 {
  margin: 10px 0;
}
.account-layout {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.account-aside,
.account-main {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.account-identity,
.membership-card,
.profile-card,
.account-quota-section {
  background: white;
  border: 1px solid #e4e8f0;
  border-radius: 16px;
  padding: 24px;
}
.account-identity {
  text-align: center;
}
.account-avatar {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin: 2px auto 18px;
  border-radius: 20px;
  background: #edeffd;
  color: #4051c3;
  font: 32px var(--serif);
}
.account-identity h2 {
  font: 600 23px var(--serif);
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}
.account-identity > p {
  color: #8190a6;
  font-size: 12px;
}
.account-identity dl {
  padding-top: 22px;
  margin-top: 22px;
  border-top: 1px solid #e9edf3;
  font-size: 13px;
  text-align: left;
}
.account-identity dt {
  color: #8c97a9;
  font-size: 12px;
}
.account-identity dd {
  margin: 8px 0 20px;
}
.account-hint {
  font-size: 12px;
  line-height: 1.8;
  color: #8a96a9;
}
.account-hint .ali-icon {
  margin-right: 5px;
}
.membership-card h2,
.profile-card h2,
.account-quota-section h2 {
  font-size: 17px;
  margin: 0 0 10px;
}
.membership-card {
  background: linear-gradient(135deg, #fffdfa, #faf7f0);
  border-color: #eae4d9;
}
.membership-card > p {
  font-size: 12px;
  line-height: 1.8;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-heading .text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.quota {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.quota article {
  padding: 16px 12px;
  border-radius: 10px;
  background: #f7f9fd;
  min-width: 0;
}
.quota span {
  font-size: 11px;
  color: #8290a6;
}
.quota strong {
  display: block;
  margin-top: 12px;
  font-size: 20px;
  font-weight: 600;
  color: #263e62;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.profile-fields {
  border: 0;
  margin: 24px 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.profile-fields label {
  display: grid;
  gap: 10px;
  font-size: 13px;
}
.profile-fields p {
  margin: 0 0 10px;
  font-size: 13px;
}
.profile-fields input[readonly] {
  background: #f7f9fc;
  color: #8b97aa;
}
.profile-select-prompt {
  border: 1px dashed #dce3ef;
  border-radius: 9px;
  padding: 20px;
  color: #8c98aa;
  font-size: 12px;
  line-height: 1.7;
}
.profile-card footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding-top: 20px;
  border-top: 1px solid #e9edf4;
}
.profile-card footer span {
  font-size: 11px;
  color: #8c98aa;
}
@media (max-width: 1100px) {
  .quota {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 800px) {
  .account-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .account-aside {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .account-identity {
    text-align: left;
  }
  .account-avatar {
    margin-left: 0;
  }
}
@media (max-width: 600px) {
  .account-aside,
  .profile-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .profile-card footer {
    flex-wrap: wrap;
  }
  .profile-card,
  .account-quota-section,
  .account-identity,
  .membership-card {
    padding: 20px;
  }
}
</style>
