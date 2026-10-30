<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps<{ title: string; busy?: boolean; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let previous: HTMLElement | null = null;
onMounted(() => {
  previous = document.activeElement as HTMLElement;
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previous?.focus();
});
function close() {
  if (!props.busy) emit('close');
}
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="material-dialog"
      :class="{ wide }"
      :aria-label="title"
      @cancel.prevent="close"
      @click="$event.target === dialog && close()"
    >
      <div class="dialog-inner">
        <header>
          <div>
            <small>知项 · 素材空间</small>
            <h2>{{ title }}</h2>
          </div>
          <button
            type="button"
            class="button"
            :disabled="busy"
            aria-label="关闭弹窗"
            @click="close"
          >
            关闭
          </button>
        </header>
        <slot />
      </div></dialog
  ></Teleport>
</template>
<style scoped>
.material-dialog {
  width: min(580px, calc(100vw - 32px));
  max-height: calc(100dvh - 40px);
  border: 1px solid #e2e9f3;
  border-radius: 20px;
  padding: 0;
  box-shadow: 0 24px 80px #24365a33;
  color: #33435e;
  background: white;
  overflow: auto;
  animation: arrive 0.2s ease-out;
}
.material-dialog.wide {
  width: min(1000px, calc(100vw - 32px));
}
.material-dialog::backdrop {
  background: #1b2d4c66;
  backdrop-filter: blur(4px);
}
.dialog-inner {
  padding: 26px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  gap: 16px;
}
h2 {
  margin: 6px 0 0;
  font-size: 21px;
}
header small {
  font-size: 11px;
  letter-spacing: 1px;
  color: #91a0b8;
}
@keyframes arrive {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .material-dialog {
    animation: none;
  }
}
@media (max-width: 500px) {
  .dialog-inner {
    padding: 18px;
  }
}
</style>
