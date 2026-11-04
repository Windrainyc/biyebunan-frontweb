<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
defineProps<{ title: string; description?: string; busy?: boolean; breadcrumb?: string }>();
const emit = defineEmits<{ back: [] }>();
const heading = ref<HTMLElement>();
onMounted(async () => {
  await nextTick();
  heading.value?.focus();
  window.scrollTo(0, 0);
});
</script>
<template>
  <Teleport to="#workspace-create-page" defer>
    <section class="create-page">
      <header class="create-page-heading">
        <button type="button" class="button" :disabled="busy" @click="emit('back')">
          <Icon name="left" />返回列表
        </button>
        <div>
          <p class="create-page-breadcrumb">{{ breadcrumb || '新增记录' }}</p>
          <h1 ref="heading" tabindex="-1">{{ title }}</h1>
          <p v-if="description" class="muted">{{ description }}</p>
        </div>
      </header>
      <div class="create-page-card"><slot /></div>
    </section>
  </Teleport>
</template>
<style>
.page:has(#workspace-create-page > .create-page) > :not(#workspace-create-page) {
  display: none !important;
}
.create-page:has(~ .create-page) {
  display: none;
}
.create-page {
  max-width: 1080px;
  margin: 0 auto;
  padding-bottom: 24px;
}
.create-page-heading {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin: 8px 0 28px;
}
.create-page-heading h1 {
  margin: 0 0 10px;
  font-size: 26px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-weight: 650;
  line-height: 1.4;
  outline: none;
}
.create-page-heading .button {
  flex-shrink: 0;
  margin-top: 24px;
}
.create-page-breadcrumb {
  margin: 0 0 6px;
  color: #7a879d;
  font-size: 12px;
}
.create-page-card {
  background: white;
  border: 1px solid #e1e7f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px #253c6510;
  padding: 32px;
}
.create-page-card .form-grid,
.create-page-card .ann-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.create-page-card .wide {
  grid-column: 1 / -1;
}
.create-page-card .resource-form-body {
  padding: 0 !important;
  overflow: visible !important;
  max-height: none !important;
}
.create-page-card .resource-form-footer,
.create-page-card footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 22px 0 0;
  margin-top: 28px;
  border-top: 1px solid #e9edf3;
  background: white;
}
.create-page-card .resource-form-footer .button,
.create-page-card footer .button {
  min-width: 100px;
}
.create-page-card label,
.create-page-card .form-field {
  display: grid;
  align-content: start;
  gap: 8px;
  font-size: 13px;
}
body .workspace .create-page-card label:has(> input[type='checkbox']) {
  display: flex;
  align-items: center;
  gap: 10px;
}
body .workspace .create-page-card input[type='checkbox'] {
  width: 16px;
  height: 16px;
  min-height: 0;
  flex-shrink: 0;
  margin: 0;
}
.create-page-card fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.create-page-card input,
.create-page-card textarea {
  max-width: 100%;
}
.create-page-card textarea {
  min-height: 120px;
}
.create-section-heading {
  padding-bottom: 20px;
  margin-bottom: 24px;
  border-bottom: 1px solid #edf0f5;
}
.create-section-heading h2 {
  font-size: 16px;
  margin: 0 0 8px;
}
.create-section-heading p {
  margin: 0;
  font-size: 12px;
}
.create-page-card .resource-modal-heading {
  display: none;
}
@media (max-width: 720px) {
  .create-page-heading {
    flex-direction: column;
    gap: 16px;
  }
  .create-page-heading .button {
    margin: 0;
  }
  .create-page-card {
    padding: 20px;
  }
  .create-page-card .form-grid,
  .create-page-card .ann-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<style>
.create-page-heading {
  margin-bottom: 18px;
  gap: 18px;
}
.create-page-heading h1 {
  font-size: 24px;
  margin-bottom: 4px;
}
.create-page-heading .button {
  margin-top: 12px;
}
.create-page-breadcrumb {
  display: none;
}
.create-resource-form .resource-form-footer {
  position: sticky;
  bottom: 0;
  z-index: 12;
  background: #fff;
  border-top: 1px solid #e1e7f0;
  padding: 16px 0;
}
.create-page-card {
  overflow: visible;
}
</style>

<style>
.create-page-heading {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin: 0 0 20px;
}
.create-page-heading > .button {
  align-self: flex-start;
  margin: 0;
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: #536783;
  font-size: 13px;
}
.create-page-heading > .button:hover {
  background: #eaf3ff;
  color: #245b9b;
}
</style>
