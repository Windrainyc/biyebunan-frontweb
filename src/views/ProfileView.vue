<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { ApiError, auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import type { Row, User } from '../types/api';
import ReferenceField from '../components/ReferenceField.vue';
import StatusBadge from '../components/StatusBadge.vue';
import CompactDialog from '../components/CompactDialog.vue';
import UserAvatar from '../components/UserAvatar.vue';
import AssetUpload from '../components/AssetUpload.vue';
import ReferenceName from '../components/ReferenceName.vue';
import QuotaChart from '../components/QuotaChart.vue';
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
const avatarIndex = ref(0),
  avatarAssetId = ref<string | null>(null),
  avatarUploading = ref(false);
const editing = ref(false);
const remainingDays = computed(() =>
  membership.value
    ? Math.max(
        0,
        Math.ceil((Date.parse(String(membership.value.expiresAt)) - Date.now()) / 86400000),
      )
    : 0,
);
function closeEditor() {
  if (busy.value || avatarUploading.value) return;
  if (
    profile.value &&
    (name.value !== String(profile.value.displayName || '') ||
      school.value !== String(profile.value.schoolId || '') ||
      major.value !== String(profile.value.majorId || '') ||
      avatarIndex.value !== Number(profile.value.avatarIndex || 0) ||
      avatarAssetId.value !==
        (profile.value.avatarAssetId ? String(profile.value.avatarAssetId) : null)) &&
    !window.confirm('还有未保存的资料，确定放弃修改？')
  )
    return;
  editing.value = false;
  void loadProfile();
}
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
    avatarIndex.value = Number(value.avatarIndex || 0);
    avatarAssetId.value = value.avatarAssetId ? String(value.avatarAssetId) : null;
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
    const body = {
      displayName: name.value.trim(),
      schoolId: auth.platform === 'admin' ? null : school.value,
      majorId: auth.platform === 'admin' ? null : major.value,
      avatarIndex: avatarIndex.value,
      avatarAssetId: avatarAssetId.value,
    };
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
    editing.value = false;
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
    <header class="account-heading account-welcome">
      <UserAvatar
        :variant="auth.platform"
        :index="auth.user?.avatarIndex"
        :asset-id="auth.user?.avatarAssetId"
        :size="88"
      />
      <div>
        <h1>你好，{{ auth.user?.displayName }}</h1>
        <p class="muted">让成长，有迹可循。</p>
      </div>
      <button class="button" :disabled="!profile || profileLoading" @click="editing = true">
        编辑个人资料
      </button>
    </header>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="profileError" class="error" role="alert">
      {{ profileError }} <button class="button" @click="loadProfile">重试</button>
    </p>
    <div class="account-overview">
      <section class="profile-card">
        <div class="section-heading">
          <h2>个人资料</h2>
          <StatusBadge :value="auth.user?.status" />
        </div>
        <dl class="profile-summary">
          <div>
            <dt>昵称</dt>
            <dd>{{ auth.user?.displayName }}</dd>
          </div>
          <div>
            <dt>手机号</dt>
            <dd>{{ auth.user?.phoneMasked }}</dd>
          </div>
          <div>
            <dt>账户类型</dt>
            <dd>
              {{
                auth.platform === 'admin'
                  ? '管理员账户'
                  : auth.platform === 'student'
                    ? '学生账户'
                    : '中介账户'
              }}
            </dd>
          </div>
          <div v-if="auth.platform !== 'admin'">
            <dt>院校 / 专业</dt>
            <dd>
              <ReferenceName field="schoolId" :value="profile?.schoolId" /> /
              <ReferenceName field="majorId" :value="profile?.majorId" />
            </dd>
          </div>
        </dl>
      </section>
      <section v-if="auth.platform === 'student'" class="membership-card">
        <div class="section-heading">
          <h2>当前会员</h2>
          <StatusBadge v-if="membership" :value="membership.state" />
        </div>
        <p v-if="membershipLoading" role="status">正在读取会员…</p>
        <p v-else-if="membershipError" class="error">
          {{ membershipError }}<button class="text-button" @click="loadMembership">重试</button>
        </p>
        <template v-else-if="membership"
          ><div class="membership-summary">
            <div>
              <strong>{{ remainingDays }} <small>天</small></strong
              ><span>剩余有效期</span>
            </div>
            <div>
              <strong class="membership-date">{{
                new Date(String(membership.expiresAt)).toLocaleDateString()
              }}</strong
              ><span>到期日期</span>
            </div>
          </div>
          <p class="account-hint">
            {{ new Date(String(membership.startsAt)).toLocaleDateString() }} 开始 ·
            会员期限与额度独立管理
          </p></template
        >
        <p v-else class="muted">当前没有会员记录</p>
      </section>
      <section v-if="auth.platform === 'student'" class="account-quota-section">
        <div class="section-heading">
          <h2>我的额度</h2>
          <button class="text-button" :disabled="quotaLoading" @click="loadQuota">刷新额度</button>
        </div>
        <p v-if="quotaLoading" role="status">正在读取额度…</p>
        <p v-else-if="quotaError" class="error">
          {{ quotaError }}<button class="text-button" @click="loadQuota">重试</button>
        </p>
        <QuotaChart v-else-if="quota" :quota="quota" />
      </section>
    </div>
    <CompactDialog
      v-if="editing"
      title="编辑个人资料"
      wide
      :busy="busy || avatarUploading"
      @back="closeEditor"
    >
      <form v-if="profile" id="profile-edit-form" @submit.prevent="save">
        <div v-if="auth.platform !== 'partner'" class="avatar-editor">
          <div class="avatar-edit-heading">
            <UserAvatar
              :variant="auth.platform"
              :index="avatarIndex"
              :asset-id="avatarAssetId"
              :size="72"
            />
            <div>
              <h3>个人头像</h3>
              <p class="account-hint">选择卡通头像，或上传不超过5MB的PNG、JPEG、WebP图片。</p>
            </div>
          </div>
          <div class="default-avatars">
            <button
              v-for="i in 10"
              :key="i"
              type="button"
              :aria-label="`选择头像${i}`"
              :aria-pressed="!avatarAssetId && avatarIndex === i - 1"
              :disabled="busy || avatarUploading"
              @click="
                avatarIndex = i - 1;
                avatarAssetId = null;
              "
            >
              <UserAvatar :variant="auth.platform" :index="i - 1" :size="46" />
            </button>
          </div>
          <button
            type="button"
            class="text-button"
            :disabled="busy || avatarUploading"
            @click="
              avatarIndex = Math.floor(Math.random() * 10);
              avatarAssetId = null;
            "
          >
            随机选一个
          </button>
          <AssetUpload
            owner-type="PROFILE"
            :owner-id="String(profile.id)"
            compact
            @busy="avatarUploading = $event"
            @ready="avatarAssetId = String($event.id)"
          />
        </div>
        <fieldset :disabled="busy" class="profile-fields">
          <label>姓名 <input v-model="name" maxlength="200" required /></label>
          <label>手机号 <input :value="String(profile.phoneMasked)" readonly /></label>
          <div v-if="auth.platform !== 'admin'">
            <p>院校 <span aria-hidden="true" class="danger">*</span></p>
            <ReferenceField
              v-model="school"
              dropdown
              field="schoolId"
              required
              aria-label="院校"
              @update:model-value="major = ''"
            />
          </div>
          <div v-if="auth.platform !== 'admin'">
            <p>专业 <span aria-hidden="true" class="danger">*</span></p>
            <ReferenceField
              v-if="school"
              v-model="major"
              dropdown
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
      </form>
      <template #footer
        ><small>仅保存当前账户的资料</small>
        <div class="footer-actions">
          <button
            type="button"
            class="button"
            :disabled="busy || avatarUploading"
            @click="closeEditor"
          >
            取消</button
          ><button
            type="submit"
            form="profile-edit-form"
            class="button primary"
            :disabled="busy || avatarUploading || conflict || (auth.platform !== 'admin' && (!school || !major)) || !name.trim()"
          >
            {{ busy ? '保存中…' : '保存资料' }}
          </button>
        </div></template
      >
    </CompactDialog>
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
  border-radius: 50%;
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
  background: #edf2ff;
  border-color: #dbe5ff;
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
.membership-expiry {
  display: block;
  font-size: 27px;
  font-weight: 650;
  margin: 20px 0 6px;
  color: #294783;
}
.avatar-edit-heading {
  display: flex;
  gap: 16px;
  align-items: center;
}
.avatar-edit-heading h3 {
  margin: 0;
}
.default-avatars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0;
}
.default-avatars button {
  padding: 3px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 50%;
  justify-self: start;
}
.default-avatars button[aria-pressed='true'] {
  border-color: #315cde;
  background: #edf2ff;
}
.avatar-editor {
  padding-top: 15px;
}
.account-welcome {
  display: flex;
  align-items: center;
  gap: 22px;
}
.account-welcome button {
  margin-left: auto;
}
.account-welcome h1 {
  font-family: inherit;
  font-size: 28px;
}
.account-overview h2 {
  font-family: inherit;
  font-size: 17px;
}
.account-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.profile-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
}
.profile-summary dt {
  font-size: 12px;
  color: #8390a5;
}
.profile-summary dd {
  margin: 10px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.membership-summary {
  display: flex;
  gap: 35px;
  margin: 32px 0;
}
.membership-summary strong {
  display: block;
  font-size: 28px;
  color: #294783;
}
.membership-summary span {
  display: block;
  font-size: 12px;
  color: #7d8ba4;
  margin-top: 10px;
}
.membership-summary .membership-date {
  font-size: 22px;
  padding-top: 5px;
}
.membership-summary small {
  font-size: 14px;
}
@media (max-width: 650px) {
  .account-overview h2 {
    font-family: inherit;
    font-size: 17px;
  }
  .account-overview {
    grid-template-columns: 1fr;
  }
  .account-welcome {
    flex-wrap: wrap;
    gap: 14px;
  }
  .account-welcome h1 {
    font-size: 22px;
  }
  .account-welcome button {
    margin-left: 0;
  }
  .membership-summary {
    gap: 24px;
  }
}
</style>
