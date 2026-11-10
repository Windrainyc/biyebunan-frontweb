<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import CompactDialog from '../components/CompactDialog.vue';
interface Model {
  code: string;
  name: string;
  selected: boolean;
  input: string;
  output: string;
  cached: string;
}
interface State {
  version: number;
  enabled: boolean;
  keyConfigured: boolean;
  checkedAt: string | null;
  checkError: string | null;
  availableCodes: string[];
  models: Model[];
  endpoint: string;
  priceSource: string;
  priceVersion: string;
  priceCheckedAt: string;
}
const state = ref<State | null>(null),
  secret = ref(''),
  codes = ref<string[]>([]),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  modal = ref('');
const canWrite = computed(() =>
  [
    'models:write',
    'model-prices:write',
    'post_admin_model_keys',
    'post_admin_model_keys_id_rotate',
    'post_admin_model_keys_id_status',
  ].every((p) => auth.permissions.includes(p)),
);
const dirty = computed(
  () =>
    !!secret.value ||
    JSON.stringify([...codes.value].sort()) !==
      JSON.stringify(
        (state.value?.models.filter((m) => m.selected).map((m) => m.code) || []).sort(),
      ),
);
const connected = computed(
  () =>
    !!state.value?.checkedAt &&
    !state.value.checkError &&
    Date.now() - Date.parse(state.value.checkedAt) < 86400000,
);
const ready = computed(
  () =>
    connected.value &&
    !!state.value &&
    Date.now() - Date.parse(state.value.priceCheckedAt) < 30 * 86400000 &&
    !dirty.value &&
    codes.value.length > 0 &&
    codes.value.every((c) => state.value?.availableCodes.includes(c)),
);
function install(s: State) {
  state.value = s;
  codes.value = s.models.filter((m) => m.selected).map((m) => m.code);
  secret.value = '';
}
async function load() {
  if (dirty.value && !confirm('重新加载将放弃未保存的配置，继续吗？')) return;
  busy.value = true;
  error.value = '';
  try {
    install(await request<State>('/admin/model-service'));
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function act(kind: 'save' | 'check' | 'status') {
  if (!state.value || busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    if (kind === 'check' && (dirty.value || !state.value.checkedAt)) {
      install(
        await request<State>('/admin/model-service', {
          method: 'PUT',
          version: state.value.version,
          body: { secretValue: secret.value.trim() || null, codes: codes.value },
        }),
      );
    }
    const s = await request<State>('/admin/model-service' + (kind === 'save' ? '' : '/' + kind), {
      method: kind === 'save' ? 'PUT' : 'POST',
      version: state.value.version,
      body:
        kind === 'save'
          ? { secretValue: secret.value || null, codes: codes.value }
          : kind === 'status'
            ? { enabled: !state.value.enabled }
            : undefined,
    });
    install(s);
    modal.value = '';
    notice.value =
      kind === 'save'
        ? '配置已保存。检查连接后可启用服务。'
        : kind === 'check'
          ? s.checkError || '只读检查完成，未发送生成请求。'
          : s.enabled
            ? '服务已启用。'
            : '服务已停用。';
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
function leaving(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onMounted(() => {
  load();
  window.addEventListener('beforeunload', leaving);
});
onUnmounted(() => window.removeEventListener('beforeunload', leaving));
onBeforeRouteLeave(() => !dirty.value || confirm('配置尚未保存，确定离开吗？'));
</script>
<template>
  <div class="managed-models">
    <div class="head">
      <div>
        <h1>模型与计费</h1>
        <p class="muted">让 AI 能力清晰可控，让每一份用量都有依据。</p>
      </div>
      <button :disabled="busy" @click="load">刷新状态</button>
    </div>
    <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
    <p v-if="notice" class="feedback" role="status">{{ notice }}</p>
    <p v-if="!state" class="muted">
      {{ busy ? '正在加载服务配置…' : '配置未能加载，请刷新重试。' }}
    </p>
    <div v-if="state" class="model-reference-note">
      价格单位为人民币 / 百万 tokens，当前显示平台核对的成本参考价，实际费用以供应商账单为准。
    </div>
    <div v-if="state" class="model-reference-summary">
      <article>
        <span>已接入模型</span><strong>{{ state.models.length }}</strong
        ><small>官方模型模板</small>
      </article>
      <article>
        <span>已选模型</span><strong>{{ codes.length }}</strong
        ><small>{{ dirty ? '有待保存修改' : '已保存配置' }}</small>
      </article>
      <article>
        <span>连接检查</span><strong>{{ connected ? '已通过' : '待检查' }}</strong
        ><small>保存配置后检查</small>
      </article>
      <article>
        <span>学生调用</span><strong>{{ state.enabled ? '已启用' : '未启用' }}</strong
        ><small>以服务开关为准</small>
      </article>
    </div>
    <div v-if="state" class="layout">
      <div class="card">
        <div class="cardtop">
          <div class="service">
            <span class="mark">D</span>
            <div>
              <h2>DeepSeek</h2>
              <small>官方直连</small>
            </div>
          </div>
          <span class="badge">{{ state.enabled ? '已启用' : '未启用' }}</span>
        </div>
        <section class="section">
          <div class="sectionhead">
            <span class="num">1</span>
            <h3>连接账户</h3>
            <small>只需配置一次</small>
          </div>
          <div class="keyrow">
            <input
              v-model="secret"
              type="password"
              aria-label="API Key"
              :placeholder="state.keyConfigured ? '已保存密钥，留空保留' : '填写 DeepSeek API Key'"
              autocomplete="new-password"
              :disabled="busy || !canWrite"
              maxlength="4096"
            /><button
              :disabled="
                busy || !canWrite || (!secret.trim() && !state.keyConfigured) || state.enabled
              "
              @click="act('check')"
            >
              {{ busy ? '处理中…' : dirty || !state.checkedAt ? '保存并检查连接' : '检查连接' }}
            </button>
          </div>
          <p class="help">
            密钥加密保存，不返回原文。检查时自动保存当前配置，仅查询官方模型列表，不生成文字。
          </p>
          <p v-if="state.enabled" class="help">服务运行中，请先停用服务再修改并检查连接。</p>
          <p v-else-if="!canWrite" class="help">当前账户没有模型配置权限。</p>
          <p v-else-if="!secret.trim() && !state.keyConfigured" class="help">
            填写 API Key 后即可保存并检查连接。
          </p>
          <p v-if="state.checkError" class="error help">{{ state.checkError }}</p>
        </section>
        <section class="section">
          <div class="sectionhead">
            <span class="num">2</span>
            <h3>选择学生可用模型</h3>
            <small>模型代码自动匹配</small>
          </div>
          <div class="model-reference-table">
            <table>
              <thead>
                <tr>
                  <th>模型</th>
                  <th>输入单价</th>
                  <th>输出单价</th>
                  <th>缓存命中</th>
                  <th>学生可选</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in state.models" :key="m.code">
                  <td>
                    <strong>{{ m.name }}</strong
                    ><small>{{ m.code }}</small>
                  </td>
                  <td>¥{{ m.input }}</td>
                  <td>¥{{ m.output }}</td>
                  <td>¥{{ m.cached }}</td>
                  <td>
                    <label class="model-switch"
                      ><input
                        v-model="codes"
                        type="checkbox"
                        :value="m.code"
                        :disabled="busy || !canWrite"
                        :aria-label="'学生可选 ' + m.name" /><span></span
                    ></label>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pricing">
            <div>
              <strong>官方成本参考价</strong>
              <p class="muted">平台维护 · {{ state.priceCheckedAt }} 核对</p>
            </div>
            <button class="text" @click="modal = 'price'">查看价格</button>
          </div>
        </section>
        <section class="section">
          <div class="sectionhead">
            <span class="num">3</span>
            <h3>使用规则</h3>
          </div>
          <div class="policy">
            <div>
              <small>可用学生范围</small>
              <p class="readonly">有效会员、额度充足且有项目权限</p>
            </div>
            <div>
              <small>学生额度规则</small>
              <p class="readonly">沿用会员套餐额度</p>
            </div>
          </div>
          <p class="help">
            官方价格用于成本估算，学生额度按现有词元规则扣减。启用不改变会员与项目权限。
          </p>
        </section>
        <details>
          <summary>高级设置 · 已按官方配置，无需填写</summary>
          <dl>
            <dt>接入协议</dt>
            <dd>OpenAI 兼容</dd>
            <dt>请求地址</dt>
            <dd>{{ state.endpoint }}</dd>
            <dt>允许域名</dt>
            <dd>api.deepseek.com · 官方固定地址</dd>
            <dt>历史配置</dt>
            <dd>
              <RouterLink to="/admin/model-prices">价格记录</RouterLink> ·
              <RouterLink to="/admin/model-keys">密钥记录</RouterLink>
            </dd>
            <dt>密钥保存</dt>
            <dd>加密保存，只展示配置状态</dd>
          </dl>
        </details>
        <div class="footer">
          <small>保存会停用服务，需重新检查并启用</small>
          <div class="row">
            <button
              :disabled="busy || !canWrite || (!secret.trim() && !state.keyConfigured)"
              @click="act('save')"
            >
              保存配置</button
            ><button
              class="primary"
              :disabled="busy || !canWrite || (!state.enabled && !ready)"
              @click="modal = 'status'"
            >
              {{ state.enabled ? '停用服务' : '启用服务' }}
            </button>
          </div>
        </div>
      </div>
      <aside class="aside">
        <div class="card">
          <div class="checkhead">
            <small>服务可用性</small>
            <div class="status">
              {{ state.enabled ? '服务已启用' : ready ? '配置就绪' : '待完善配置' }}
            </div>
            <p class="muted">
              {{
                dirty
                  ? '存在未保存修改，请先保存。'
                  : state.enabled
                    ? '已开放所选模型，学生须满足使用规则。'
                    : '保存、检查连接后，显式启用学生调用。'
              }}
            </p>
          </div>
          <div class="checks">
            <div class="check">
              <span>账户连接</span
              ><b>{{ connected ? '检查通过' : state.keyConfigured ? '待检查' : '未配置' }}</b>
            </div>
            <div class="check">
              <span>模型选择</span><b>已选 {{ codes.length }} 个</b>
            </div>
            <div class="check"><span>官方价格</span><b>已提供参考版本</b></div>
            <div class="check"><span>官方接入地址</span><b>自动配置</b></div>
            <div class="check">
              <span>学生调用</span><b>{{ state.enabled ? '已开启' : '待启用' }}</b>
            </div>
          </div>
          <div class="asidefoot">
            {{
              connected && codes.some((c) => !state?.availableCodes.includes(c))
                ? '账户未返回全部所选模型，请调整选择后重新检查。'
                : '无需切换模型、价格和密钥菜单。'
            }}
          </div>
        </div>
        <div class="card preview">
          <h3>学生端显示预览</h3>
          <p class="help">启用后显示以下模型</p>
          <div
            v-for="m in state.models.filter((m) => codes.includes(m.code))"
            :key="m.code"
            class="previewbox"
          >
            {{ m.name }}
          </div>
          <p v-if="!codes.length" class="help">尚未选择模型</p>
        </div>
      </aside>
    </div>
    <CompactDialog
      v-if="modal === 'status' && state"
      :title="state.enabled ? '停用 DeepSeek 服务？' : '启用 DeepSeek 服务？'"
      :busy="busy"
      @back="modal = ''"
      ><p>
        {{
          state.enabled
            ? '停用后禁止新提问，已开始的请求按原流程结算，历史对话仍可查看。'
            : '启用后，符合使用规则的学生可以使用所选模型。'
        }}
      </p>
      <p v-if="!state.enabled" class="pricing">
        学生提问会消耗你的 DeepSeek 账户余额。本次不会自动发送测试问题。
      </p>
      <template #footer
        ><div class="footer-actions">
          <button :disabled="busy" @click="modal = ''">取消</button
          ><button class="primary" :disabled="busy" @click="act('status')">
            {{ busy ? '处理中…' : state.enabled ? '确认停用' : '确认启用' }}
          </button>
        </div></template
      ></CompactDialog
    >
    <CompactDialog v-if="modal === 'price' && state" title="官方成本参考价" wide @back="modal = ''"
      ><p>人民币 / 百万 tokens；高峰参考价</p>
      <div style="overflow: auto">
        <table>
          <thead>
            <tr>
              <th>模型</th>
              <th>输入</th>
              <th>缓存命中</th>
              <th>输出</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in state.models" :key="m.code">
              <td>{{ m.name }}</td>
              <td>¥{{ m.input }}</td>
              <td>¥{{ m.cached }}</td>
              <td>¥{{ m.output }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>官方非高峰时段为表中价格的一半。平台当前按高峰价保守估算，实际费用以供应商账单为准。</p>
      <p class="help">
        价格版本：{{ state.priceVersion }} · 核对日期：{{
          state.priceCheckedAt
        }}。模板由平台维护，并非实时抓取；历史运行保留价格快照。
      </p>
      <a :href="state.priceSource" target="_blank" rel="noopener noreferrer">查看官方价目表</a
      ><template #footer
        ><div class="footer-actions">
          <button class="primary" @click="modal = ''">完成</button>
        </div></template
      ></CompactDialog
    >
  </div>
</template>

<style scoped>
.managed-models {
  --blue: #002fa7;
  --bg: #f7f7f8;
  --line: #e8ebf0;
  --ink: #202b3e;
  --muted: #7b8596;
}
* {
  box-sizing: border-box;
}
.managed-models {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font:
    14px/1.6 'Helvetica Neue',
    'PingFang SC',
    Arial,
    sans-serif;
}
button,
input,
select {
  font: inherit;
}
button {
  cursor: pointer;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: white;
  color: var(--ink);
}
button:hover {
  border-color: #9eafd2;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.primary {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
}
.text {
  border: 0;
  color: var(--blue);
  background: none;
  padding: 0;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1 {
  font-size: 26px;
  font-weight: 600;
}
h2 {
  font-size: 16px;
  font-weight: 600;
}
h3 {
  font-size: 14px;
  font-weight: 600;
}
.muted,
small {
  color: var(--muted);
  font-size: 12px;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 23px;
}
.head p {
  margin-top: 5px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
select,
input {
  height: 38px;
  border: 1px solid #dce1e9;
  border-radius: 6px;
  padding: 0 11px;
  background: white;
  color: var(--ink);
  min-width: 0;
}
select {
  font-size: 12px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 306px;
  gap: 20px;
}
.card {
  border: 1px solid var(--line);
  background: white;
  border-radius: 10px;
  overflow: hidden;
}
.cardtop {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.service {
  display: flex;
  gap: 12px;
  align-items: center;
}
.mark {
  background: #edf3ff;
  color: var(--blue);
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 650;
  font-size: 20px;
}
.badge {
  font-size: 11px;
  padding: 4px 9px;
  background: #f1f3f6;
  color: #687488;
  border-radius: 5px;
}
.badge.ready {
  color: var(--blue);
  background: #edf3ff;
}
.section {
  padding: 24px;
  border-bottom: 1px solid var(--line);
}
.sectionhead {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.num {
  color: var(--blue);
  font-size: 12px;
  border: 1px solid #dce5fa;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.sectionhead small {
  margin-left: auto;
}
.keyrow {
  display: flex;
  gap: 10px;
}
.keyrow input {
  flex: 1;
  width: 100%;
}
.help {
  font-size: 12px;
  color: var(--muted);
  margin-top: 9px;
}
.models {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.model {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}
.model:has(input:checked) {
  border-color: var(--blue);
  background: #f8faff;
}
.model input {
  position: absolute;
  right: 14px;
  top: 16px;
  accent-color: var(--blue);
  height: 16px;
  width: 16px;
}
.model h3 {
  padding-right: 22px;
}
.model p {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
}
.model .code {
  font-size: 11px;
  margin-top: 18px;
  color: #8a93a3;
}
.pricing {
  margin-top: 18px;
  background: #f7f7f8;
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.policy {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.policy label {
  font-size: 12px;
  display: block;
  color: #647086;
}
.policy select,
.policy input {
  display: block;
  width: 100%;
  margin-top: 7px;
}
details {
  padding: 18px 24px;
}
summary {
  cursor: pointer;
  font-size: 12px;
  color: #69768a;
}
dl {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 0;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}
.aside {
  align-self: start;
}
.checkhead {
  padding: 22px;
  border-bottom: 1px solid var(--line);
}
.status {
  font-size: 21px;
  font-weight: 600;
  margin: 13px 0 5px;
}
.checks {
  padding: 10px 22px;
}
.check {
  padding: 13px 0;
  border-bottom: 1px solid #f0f1f4;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.check:last-child {
  border: 0;
}
.check b {
  font-weight: 500;
  color: var(--blue);
}
.check b.fail {
  color: #a96030;
}
.asidefoot {
  padding: 18px 22px;
  background: #fafafb;
  font-size: 12px;
  color: var(--muted);
}
.preview {
  margin-top: 16px;
  padding: 21px;
}
.previewbox {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  margin-top: 14px;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
}
.note {
  margin-top: 18px;
  color: var(--muted);
  font-size: 12px;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  margin: 18px 0;
}
td,
th {
  text-align: left;
  padding: 11px 8px;
  border-bottom: 1px solid var(--line);
}
th {
  font-weight: 500;
  color: var(--muted);
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #b4c9ff;
  outline-offset: 2px;
}
@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .preview {
    margin-top: 0;
  }
  .wrap {
    padding: 24px;
  }
}
@media (max-width: 700px) {
  .side {
    display: none;
  }
  .app {
    margin-left: 0;
  }
  .top {
    padding: 0 18px;
  }
  .wrap {
    padding: 20px 14px;
  }
  .head {
    align-items: flex-start;
  }
  .head .row {
    display: none;
  }
  h1 {
    font-size: 23px;
  }
  .scenario {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }
  .scenario select {
    width: 100%;
  }
  .layout {
    gap: 16px;
  }
  .models,
  .policy,
  .aside {
    grid-template-columns: 1fr;
  }
  .cardtop,
  .section {
    padding: 18px;
  }
  .sectionhead small {
    display: none;
  }
  .footer {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 13px 16px;
    z-index: 2;
  }
  .footer small {
    display: none;
  }
  .footer .row {
    width: 100%;
    justify-content: flex-end;
  }
  .pricing {
    align-items: flex-start;
  }
  .keyrow {
    flex-wrap: wrap;
  }
  .keyrow input {
    flex-basis: 100%;
  }
  .note {
    margin-bottom: 20px;
  }
  dl {
    grid-template-columns: 80px 1fr;
  }
}

.managed-models {
  padding: 0;
  background: transparent;
}
.feedback {
  padding: 12px 16px;
  border-radius: 6px;
  background: #edf3ff;
  margin-bottom: 16px;
}
.error {
  color: #b03838;
}
.readonly {
  padding: 10px 0;
  font-size: 13px;
}
.model {
  display: block;
}
.model input {
  min-height: 0;
}
.models h3 {
  font-size: 14px;
}
.primary {
  background: #002fa7;
  color: white;
}
.footer .row {
  flex-shrink: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 12px 8px;
  text-align: left;
  border-bottom: 1px solid #e8ebf0;
}
</style>
