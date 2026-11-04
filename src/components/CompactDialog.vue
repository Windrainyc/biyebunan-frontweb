<script setup lang="ts">
import Icon from './Icon.vue';
defineProps<{ title: string; description?: string; busy?: boolean }>();
const emit = defineEmits<{ back: [] }>();
</script>
<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <section
        v-dialog="
          () => {
            if (!busy) emit('back');
          }
        "
        class="compact-operation"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header>
          <h2>{{ title }}</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="关闭"
            :disabled="busy"
            @click="emit('back')"
          >
            <Icon name="close" />
          </button>
        </header>
        <p v-if="description" class="muted">{{ description }}</p>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.compact-operation {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e8f2;
  border-radius: 12px;
  padding: 22px;
  box-shadow: 0 18px 65px #14284030;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  font-size: 18px;
  margin: 0;
}
:deep(h2) {
  font-size: 16px;
}
:deep(input:not([type='checkbox'])),
:deep(textarea),
:deep(select) {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dce3ed;
  border-radius: 7px;
  min-height: 38px;
  padding: 8px 10px;
  font: inherit;
}
:deep(input[type='checkbox']) {
  width: 16px;
  min-height: 16px;
  height: 16px;
  padding: 0;
}
:deep(form > .button) {
  justify-self: end;
  width: auto;
  min-width: 96px;
}
:deep(.record-actions) {
  margin: 0;
  border: 0;
  padding: 0;
}
</style>
