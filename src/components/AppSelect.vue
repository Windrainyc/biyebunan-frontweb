<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { selectLayout } from './select-layout';
import { stableSelectOptions } from './select-options';
import { ref, computed, onMounted, onBeforeUnmount, nextTick, useAttrs, useId, watch } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  modelValue?: unknown;
  modelModifiers?: { number?: boolean };
  disabled?: boolean;
  required?: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'change']);
const attrs = useAttrs();
const native = ref<HTMLSelectElement>();
const trigger = ref<HTMLButtonElement>();
const popup = ref<HTMLElement>();
const open = ref(false);
const options = ref<{ value: string; label: string; disabled: boolean }[]>([]);
const active = ref(0);
const position = ref<Record<string, string>>({});
const id = useId();
const selected = computed(() =>
  options.value.find((o) => o.value === String(props.modelValue ?? '')),
);
let observer: MutationObserver | undefined;
function sync() {
  const next = Array.from(native.value?.options ?? []).map((o) => ({
    value: o.value,
    label: o.text.trim(),
    disabled:
      o.disabled || (o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled),
  }));
  // Vue会重新写入option属性；值未变时必须保持状态引用，避免观察器与渲染互相触发。
  if (stableSelectOptions(options.value, next) !== options.value) {
    options.value = next;
    // 异步刷新可能移除/重排选项，关闭旧菜单，避免旧高亮索引选择到另一条数据。
    if (open.value) {
      close();
      trigger.value?.focus();
    }
  }
}
function close() {
  open.value = false;
}
async function show() {
  if (props.disabled) return;
  sync();
  open.value = !open.value;
  if (!open.value) return;
  active.value = Math.max(
    0,
    options.value.findIndex((o) => o.value === String(props.modelValue ?? '')),
  );
  const r = trigger.value!.getBoundingClientRect();
  position.value = selectLayout(r, { width: window.innerWidth, height: window.innerHeight });
  await nextTick();
  popup.value?.focus();
  reveal();
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close();
  },
);
function choose(index: number) {
  if (props.disabled) return;
  const option = options.value[index];
  if (!option || option.disabled) return;
  const value =
    props.modelModifiers?.number && option.value !== '' ? Number(option.value) : option.value;
  emit('update:modelValue', value);
  emit('change', value);
  close();
  trigger.value?.focus();
}
function reveal() {
  popup.value
    ?.querySelector(`[data-index="${active.value}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    trigger.value?.focus();
    return;
  }
  if (event.key === 'Tab') {
    close();
    trigger.value?.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (open.value) choose(active.value);
    else void show();
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    if (!open.value) {
      void show();
      return;
    }
    const enabled = options.value.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const current = enabled.indexOf(active.value);
    active.value =
      event.key === 'Home'
        ? (enabled[0] ?? 0)
        : event.key === 'End'
          ? (enabled.at(-1) ?? 0)
          : (enabled[
              Math.max(
                0,
                Math.min(enabled.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
              )
            ] ?? 0);
    void nextTick(reveal);
  } else if (event.key.length === 1) {
    const found = options.value.findIndex(
      (o) => !o.disabled && o.label.toLowerCase().startsWith(event.key.toLowerCase()),
    );
    if (found >= 0) {
      active.value = found;
      reveal();
    }
  }
}
function outside(event: Event) {
  if (
    !trigger.value?.contains(event.target as Node) &&
    !popup.value?.contains(event.target as Node)
  )
    close();
}
function scrolled(event: Event) {
  if (!popup.value?.contains(event.target as Node)) close();
}
onMounted(() => {
  sync();
  observer = new MutationObserver(sync);
  observer.observe(native.value!, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', scrolled, true);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('pointerdown', outside);
  window.removeEventListener('resize', close);
  window.removeEventListener('scroll', scrolled, true);
});
</script>
<template>
  <span class="app-select" :class="attrs.class" :style="attrs.style as CSSProperties">
    <select
      ref="native"
      class="app-select-native"
      :value="modelValue"
      :required="required"
      :disabled="disabled"
      :name="attrs.name as string"
      tabindex="-1"
      aria-hidden="true"
      @invalid="trigger?.focus()"
    >
      <slot />
    </select>
    <button
      ref="trigger"
      type="button"
      class="app-select-trigger"
      :id="attrs.id as string"
      :aria-label="attrs['aria-label'] as string"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="id"
      :disabled="disabled"
      @click="show"
      @keydown="key"
    >
      <span>{{
        selected?.label || options.find((option) => option.value === '')?.label || '请选择'
      }}</span
      ><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </button>
    <Teleport to="body"
      ><div
        v-if="open"
        :id="id"
        ref="popup"
        class="app-select-popup"
        :style="position"
        role="listbox"
        tabindex="-1"
        :aria-label="attrs['aria-label'] as string"
        :aria-activedescendant="`${id}-${active}`"
        @keydown="key"
      >
        <div
          v-for="(option, index) in options"
          :id="`${id}-${index}`"
          :key="index"
          :data-index="index"
          role="option"
          :aria-selected="option.value === String(modelValue ?? '')"
          :aria-disabled="option.disabled"
          :class="{
            active: index === active,
            selected: option.value === String(modelValue ?? ''),
            disabled: option.disabled,
          }"
          @pointermove="active = index"
          @click="choose(index)"
        >
          <span>{{ option.label }}</span
          ><span v-if="option.value === String(modelValue ?? '')" aria-hidden="true">✓</span>
        </div>
        <div v-if="!options.length" class="disabled">暂无可选项</div>
      </div></Teleport
    >
  </span>
</template>
<style>
.app-select {
  display: inline-flex;
  position: relative;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
  padding: 0 !important;
  background: #fff;
  border: 1px solid #dce1eb;
  border-radius: 8px;
  font: inherit;
}
.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 9px 12px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: #25324a;
  font: inherit;
  text-align: left;
}
.app-select-trigger > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-select-trigger > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  fill: none;
  stroke: #68738b;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.app-select:focus-within {
  border-color: #8794eb;
  box-shadow: 0 0 0 3px #eef0ff;
}
.app-select-native {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  min-height: 0 !important;
  padding: 0 !important;
  opacity: 0;
  pointer-events: none;
  clip-path: inset(50%);
}
.app-select-popup {
  position: fixed;
  z-index: 10000;
  overflow: auto;
  padding: 5px;
  border: 1px solid #e1e5ef;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 32px #26335424;
  color: #25324a;
  font:
    13px/1.5 system-ui,
    sans-serif;
  outline: none;
  box-sizing: border-box;
}
.app-select-popup [role='option'] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.app-select-popup [role='option'] > span:first-child {
  overflow-wrap: anywhere;
}
.app-select-popup .active {
  background: #f3f5fc;
}
.app-select-popup .selected {
  background: #eef0ff;
  color: #4d51c5;
  font-weight: 600;
}
.app-select-popup .disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
