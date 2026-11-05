<script setup lang="ts">
import Icon from './Icon.vue';
defineProps<{ title: string; description?: string; busy?: boolean; wide?: boolean }>();
const emit = defineEmits<{ back: [] }>();
</script>
<template>
  <Teleport to="body"
    ><div class="modal-backdrop operation-backdrop">
      <section
        v-dialog="
          () => {
            if (!busy) emit('back');
          }
        "
        class="compact-operation"
        :class="{ wide }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="operation-heading">
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
        <div class="operation-body"><slot /></div>
        <footer v-if="$slots.footer" class="fixed-operation-footer"><slot name="footer" /></footer>
      </section></div
  ></Teleport>
</template>
<style>
.operation-backdrop {
  padding: 24px;
  background: #17233842;
  backdrop-filter: blur(2px);
}
.compact-operation {
  --control-height: 36px;
  --control-font: 13px;
  --button-primary-bg: #002fa7;
  --button-primary-border: #002fa7;
  --button-primary-ink: #fff;
  font:
    14px/1.5 'Helvetica Neue',
    Arial,
    'PingFang SC',
    sans-serif;
  color: #182338;
  width: min(480px, calc(100vw - 28px));
  max-height: calc(100dvh - 48px);
  background: #fff;
  border: 1px solid #e8ebf0;
  border-radius: 10px;
  box-shadow: 0 22px 70px #15213730;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.compact-operation.wide {
  width: min(560px, calc(100vw - 28px));
}
.operation-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid #e8ebf0;
  flex: none;
}
.operation-heading h2 {
  font:
    600 17px/1.5 'Helvetica Neue',
    Arial,
    'PingFang SC',
    sans-serif;
  margin: 0;
}
.operation-heading .modal-close {
  width: 32px;
  height: 32px;
  padding: 7px;
  border-radius: 5px;
  background: white;
}
.operation-body {
  overflow: auto;
  min-height: 0;
  padding: 20px 24px 0;
  overscroll-behavior: contain;
}
.operation-body > p:last-child {
  padding-bottom: 20px;
}
.operation-body .workflow-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8f9fb;
  padding: 12px 14px;
  border-radius: 5px;
  margin: 0 0 20px;
}
.workflow-summary h2 {
  font:
    500 13px/1.6 'Helvetica Neue',
    Arial,
    'PingFang SC',
    sans-serif;
  margin: 0;
  overflow-wrap: anywhere;
}
.workflow-summary p {
  margin: 0;
  font-size: 12px;
  flex-shrink: 0;
}
.compact-operation label {
  font-size: 13px;
  line-height: 20px;
  color: #455066;
}
.compact-operation input:not([type='checkbox']):not(.validation),
.compact-operation select,
.compact-operation .app-select {
  min-height: 36px;
  height: 36px;
  width: 100%;
  border: 1px solid #dce1e9;
  border-radius: 5px;
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  background: white;
}
.compact-operation textarea {
  width: 100%;
  min-height: 76px;
  border: 1px solid #dce1e9;
  border-radius: 5px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}
.compact-operation input[type='checkbox'] {
  width: 15px;
  height: 15px;
  margin: 0;
}
.compact-operation .button {
  min-height: 36px;
  height: 36px;
  padding: 0 13px;
  font-size: 12px;
  border-radius: 5px;
}
.compact-operation .record-actions {
  border: 0;
  padding: 0;
  margin: 0;
}
.compact-operation .action-form {
  margin: 0;
  gap: 18px;
}
.compact-operation .operation-footer,
.compact-operation .action-form .action-footer {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: white;
  border-top: 1px solid #e8ebf0;
  margin: 4px -24px 0;
  padding: 14px 24px;
}
.compact-operation .operation-footer .button,
.compact-operation .action-form .action-footer .button {
  min-width: 72px;
  flex: none;
}
.compact-operation .reference .dropdown-trigger {
  height: 36px;
  min-height: 36px;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 5px;
}
.compact-operation .reference .dropdown-panel {
  position: relative;
  top: auto;
  margin-top: 5px;
  padding: 7px;
  border-radius: 6px;
  box-shadow: 0 6px 16px #24314c0d;
}
.compact-operation .reference .choices {
  gap: 2px;
  margin: 6px 0;
  max-height: 156px;
}
.compact-operation .reference .dropdown-option {
  min-height: 36px;
  font-size: 12px;
  padding: 7px 10px;
}
.compact-operation .reference-foot {
  font-size: 11px;
}
.compact-operation .muted {
  font-size: 12px;
  color: #8b94a3;
}
@media (max-width: 600px) {
  .operation-backdrop {
    padding: 14px;
  }
  .compact-operation {
    max-height: calc(100dvh - 28px);
  }
  .operation-heading {
    padding: 16px 18px;
  }
  .operation-body {
    padding: 18px 18px 0;
  }
  .compact-operation .operation-footer,
  .compact-operation .action-form .action-footer {
    margin-inline: -18px;
    padding: 13px 18px;
  }
}
</style>

<style>
.compact-operation .action-footer .primary {
  order: 2;
}
.compact-operation .button.primary {
  background: #002fa7;
  color: #fff;
  border-color: #002fa7;
}
</style>

<style>
.fixed-operation-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #e8ebf0;
  padding: 16px 24px;
  background: white;
}
.fixed-operation-footer .footer-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}
.fixed-operation-footer small {
  color: #8b94a3;
  font-size: 11px;
}
@media (max-width: 600px) {
  .fixed-operation-footer {
    padding: 14px 18px;
  }
  .fixed-operation-footer small {
    display: none;
  }
}
</style>
