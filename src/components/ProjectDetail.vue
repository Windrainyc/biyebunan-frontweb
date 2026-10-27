<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import AssetUpload from './AssetUpload.vue';
const props = defineProps<{ project: Row }>();
const emit = defineEmits<{ changed: [] }>();
const attempt = writeAttempt();
const milestoneEdit = ref<Row | null>(null),
  milestoneOpen = ref(false),
  milestoneName = ref(''),
  milestoneDate = ref(''),
  milestoneWeight = ref(10),
  milestoneCompleted = ref(false);
function editMilestone(row?: Row) {
  milestoneEdit.value = row || null;
  milestoneName.value = String(row?.name || '');
  milestoneDate.value = String(row?.dueDate || '');
  milestoneWeight.value = Number(row?.weight || 10);
  milestoneCompleted.value = Boolean(row?.completed);
  milestoneOpen.value = true;
}
async function saveMilestone() {
  busy.value = true;
  try {
    const body = {
      name: milestoneName.value,
      dueDate: milestoneDate.value,
      weight: milestoneWeight.value,
      completed: milestoneCompleted.value,
    };
    const path = milestoneEdit.value
      ? `/admin/milestones/${milestoneEdit.value.id}`
      : `/admin/projects/${props.project.id}/milestones`;
    await request(path, {
      method: milestoneEdit.value ? 'PUT' : 'POST',
      body,
      version: milestoneEdit.value?.version,
      key: attempt({ path, ...body }),
    });
    milestoneOpen.value = false;
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

const deliveries = ref<Row[]>([]),
  milestones = ref<Row[]>([]),
  error = ref(''),
  uploaded = ref<Row | null>(null),
  kind = ref('TASK'),
  note = ref(''),
  reason = ref(''),
  busy = ref(false);
const kinds: Record<string, string> = {
  TASK: '任务书',
  PROPOSAL: '开题报告',
  THESIS_TEMPLATE: '论文模板',
  SOURCE_CODE: '源代码',
  QA_ATTACHMENT: '答疑资料',
  RECORDING: '操作录屏',
};
async function load() {
  if (auth.platform === 'partner') return;
  try {
    const [d, m] = await Promise.all([
      request<Page<Row>>(`/${auth.platform}/projects/${props.project.id}/deliveries`, {
        query: { page: 1, size: 100 },
      }),
      request<Page<Row>>(`/${auth.platform}/projects/${props.project.id}/milestones`, {
        query: { page: 1, size: 100 },
      }),
    ]);
    deliveries.value = d.items;
    milestones.value = m.items;
  } catch (e) {
    error.value = errorText(e);
  }
}
async function add() {
  if (!uploaded.value) return;
  busy.value = true;
  try {
    await request(`/admin/projects/${props.project.id}/deliveries`, {
      method: 'POST',
      body: { kind: kind.value, assetId: uploaded.value.id, note: note.value },
      key: attempt({ kind: kind.value, assetId: uploaded.value.id, note: note.value }),
    });
    uploaded.value = null;
    note.value = '';
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function publication(row: Row, publish: boolean) {
  busy.value = true;
  try {
    await request(`/admin/deliveries/${row.id}/${publish ? 'publish' : 'withdraw'}`, {
      method: 'POST',
      body: { reason: reason.value },
      version: row.version,
      key: attempt({ id: row.id, publish, reason: reason.value, version: row.version }),
    });
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function download(row: Row) {
  try {
    const grant = await request<{ url: string }>(
      `/${auth.platform}/assets/${row.assetId}/download`,
      { method: 'POST' },
    );
    const url = new URL(grant.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('下载地址无效');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  } catch (e) {
    error.value = errorText(e);
  }
}
onMounted(load);
</script>
<template>
  <section>
    <h3>项目里程碑</h3>
    <button v-if="auth.platform === 'admin'" class="button" @click="editMilestone()">
      新增里程碑
    </button>
    <p v-if="!milestones.length" class="muted">暂无里程碑</p>
    <div v-for="m in milestones" :key="String(m.id)" class="milestone">
      <strong>{{ m.name }}</strong
      ><span
        >{{ display(m.dueDate) }} · {{ m.weight }}% · {{ m.completed ? '已完成' : '进行中' }}</span
      >
      <button v-if="auth.platform === 'admin'" class="button" @click="editMilestone(m)">
        编辑
      </button>
    </div>
    <form v-if="milestoneOpen" class="delivery-form" @submit.prevent="saveMilestone">
      <label>里程碑名称<input v-model="milestoneName" maxlength="200" required /></label
      ><label
        >计划日期<input
          v-model="milestoneDate"
          type="date"
          :max="String(project.deliveryDate)"
          required /></label
      ><label
        >进度权重<input
          v-model.number="milestoneWeight"
          type="number"
          min="1"
          max="100"
          required /></label
      ><label><input v-model="milestoneCompleted" type="checkbox" />已完成</label
      ><button class="button primary" :disabled="busy">保存里程碑</button
      ><button type="button" class="button" @click="milestoneOpen = false">取消</button>
    </form>
    <h3>交付版本</h3>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="!deliveries.length" class="muted">暂无可查看的交付版本</p>
    <article v-for="d in deliveries" :key="String(d.id)" class="delivery">
      <div>
        <strong>{{ kinds[String(d.kind)] || '交付文件' }}</strong
        ><span>第{{ d.versionNumber }}版 · {{ display(d.state) }}</span>
      </div>
      <p>{{ d.note }}</p>
      <button class="button" @click="download(d)">下载文件</button
      ><template v-if="auth.platform === 'admin'"
        ><button
          v-if="d.state === 'READY'"
          class="button"
          :disabled="busy || !reason"
          @click="publication(d, true)"
        >
          发布版本</button
        ><button
          v-if="d.state === 'PUBLISHED'"
          class="button"
          :disabled="busy || !reason"
          @click="publication(d, false)"
        >
          撤回版本
        </button></template
      >
    </article>
    <template v-if="auth.platform === 'admin'"
      ><label>发布或撤回原因<input v-model="reason" maxlength="200" /></label>
      <h3>新增不可覆盖的交付版本</h3>
      <AssetUpload owner-type="PROJECT" :owner-id="String(project.id)" @ready="uploaded = $event" />
      <form v-if="uploaded" class="delivery-form" @submit.prevent="add">
        <label
          >资料类型<select v-model="kind">
            <option v-for="(title, value) in kinds" :key="value" :value="value">{{ title }}</option>
          </select></label
        ><label>版本说明<input v-model="note" maxlength="200" required /></label
        ><button class="button primary" :disabled="busy">创建交付版本</button>
      </form></template
    >
  </section>
</template>
<style scoped>
.milestone,
.delivery {
  padding: 16px;
  border: 1px solid #e2e6ef;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.milestone {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.milestone span,
.delivery span {
  color: #748096;
  font-size: 12px;
}
.delivery > div {
  display: flex;
  gap: 14px;
  justify-content: space-between;
}
.delivery button {
  margin-right: 8px;
}
.delivery-form {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
</style>
