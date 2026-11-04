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
  max-width: 1120px;
  margin: 0 auto;
  padding-bottom: 24px;
}
.create-page-heading {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin: 0 0 20px;
}
.create-page-heading h1 {
  font:
    600 24px/1.4 'Helvetica Neue',
    Arial,
    'PingFang SC',
    sans-serif;
  margin: 0 0 6px;
  outline: none;
}
body .workspace .create-page-heading > .button {
  align-self: flex-start;
  margin: 0;
  min-height: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7a8495;
  font-size: 12px;
}
.create-page-heading > .button:hover {
  color: #002fa7;
}
.create-page-breadcrumb {
  display: none;
}
.create-page-heading .muted {
  font-size: 12px;
  margin: 0;
}
.create-page-card {
  background: white;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  box-shadow: none;
  padding: 24px;
  overflow: visible;
}
.create-page-card .form-grid,
.create-page-card .ann-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.create-page-card .wide {
  grid-column: 1/-1;
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
  gap: 8px;
  padding: 16px 0 0;
  margin-top: 24px;
  border-top: 1px solid #e8ebf0;
  background: white;
}
.create-resource-form .resource-form-footer {
  position: sticky;
  bottom: 0;
  z-index: 12;
  padding: 16px 0;
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
  gap: 8px;
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
  min-height: 100px;
}
.create-section-heading {
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e8ebf0;
}
.create-section-heading h2 {
  font-size: 15px;
  margin: 0 0 6px;
}
.create-section-heading p {
  margin: 0;
  font-size: 12px;
}
.create-page-card .resource-modal-heading {
  display: none;
}
@media (max-width: 720px) {
  .create-page-card {
    padding: 16px;
  }
  .create-page-card .form-grid,
  .create-page-card .ann-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
