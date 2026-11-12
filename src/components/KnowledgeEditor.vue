<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { requiresMarkdownSource } from '../config/editor-markdown';
const props = defineProps<{
  modelValue: unknown;
  maxLength?: number;
  required?: boolean;
  label?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const value = computed(() => String(props.modelValue ?? ''));
const source = ref(requiresMarkdownSource(value.value));
const validity = ref<HTMLTextAreaElement>();
watch(
  [value, () => props.maxLength, validity],
  () => {
    validity.value?.setCustomValidity(
      props.maxLength && value.value.length > props.maxLength
        ? '正文超过长度限制，请精简后保存。'
        : '',
    );
  },
  { flush: 'post' },
);
const sourceRequired = computed(() => requiresMarkdownSource(value.value));
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      underline: false,
      strike: false,
      link: { openOnClick: false, autolink: false },
    }),
    Markdown,
  ],
  content: source.value ? '' : value.value,
  contentType: 'markdown',
  editorProps: {
    attributes: { role: 'textbox', 'aria-label': '知识正文可视化编辑', 'aria-multiline': 'true' },
    // 外部富文本粘贴按纯文本处理，不导入远程图片或任意HTML。
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return true;
      editor.value?.commands.insertContent({ type: 'text', text });
      return true;
    },
  },
  onUpdate: ({ editor: current }) => emit('update:modelValue', current.getMarkdown()),
});
watch(value, (next) => {
  if (source.value || !editor.value || editor.value.getMarkdown() === next) return;
  if (requiresMarkdownSource(next)) {
    source.value = true;
    return;
  }
  editor.value.commands.setContent(next, { contentType: 'markdown', emitUpdate: false });
});
function switchMode() {
  if (source.value) {
    if (sourceRequired.value) return;
    editor.value?.commands.setContent(value.value, { contentType: 'markdown', emitUpdate: false });
  }
  source.value = !source.value;
}
onBeforeUnmount(() => editor.value?.destroy());
</script>
<template>
  <div class="knowledge-editor">
    <div class="editor-top">
      <span>{{ label || '知识正文' }}</span
      ><button
        type="button"
        class="button"
        :disabled="source && sourceRequired"
        @click="switchMode"
      >
        {{ source ? '可视化编辑' : 'Markdown源码' }}
      </button>
    </div>
    <p v-if="sourceRequired" class="muted">当前正文包含复杂格式，使用源码编辑可完整保留原内容。</p>
    <textarea
      v-if="source"
      :value="value"
      :maxlength="maxLength"
      :required="required"
      aria-label="知识正文Markdown源码"
      rows="12"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <template v-else-if="editor">
      <div class="editor-toolbar" role="toolbar" aria-label="正文格式">
        <button
          type="button"
          :aria-pressed="editor.isActive('heading', { level: 2 })"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          标题
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('bold')"
          @click="editor.chain().focus().toggleBold().run()"
        >
          粗体
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('italic')"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          斜体
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          列表
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('orderedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          编号
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('blockquote')"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          引用
        </button>
        <button
          type="button"
          :aria-pressed="editor.isActive('codeBlock')"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          代码
        </button>
        <button
          type="button"
          :disabled="!editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
        >
          撤销
        </button>
        <button
          type="button"
          :disabled="!editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
        >
          重做
        </button>
      </div>
      <EditorContent :editor="editor" />
      <textarea
        ref="validity"
        class="editor-validity"
        :value="value.trim()"
        :required="required"
        tabindex="-1"
        aria-label="知识正文校验"
        @invalid.prevent="editor.commands.focus()"
      />
    </template>
    <div class="editor-foot" :class="{ error: maxLength && value.length > maxLength }">
      {{ value.length }}{{ maxLength ? ' / ' + maxLength : '' }} 字符 · 保存为Markdown
    </div>
    <p v-if="maxLength && value.length > maxLength" class="error" role="alert">
      正文超过长度限制，请精简后保存。
    </p>
  </div>
</template>
<style scoped>
.editor-validity {
  position: absolute;
  width: 1px !important;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.knowledge-editor {
  position: relative;
  border: 1px solid #dce5f2;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}
.editor-top {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  background: #f9fbff;
}
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  border-block: 1px solid #edf1f7;
}
.editor-toolbar button {
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #5c6d86;
  font-size: 12px;
  cursor: pointer;
}
.editor-toolbar button[aria-pressed='true'] {
  background: #e8f1ff;
  color: #3876ca;
}
.editor-toolbar button:disabled {
  opacity: 0.4;
}
.knowledge-editor :deep(.tiptap) {
  padding: 18px;
  min-height: 220px;
  max-height: 480px;
  overflow: auto;
  outline: none;
  font-size: 14px;
  line-height: 1.8;
}
.knowledge-editor :deep(.tiptap:focus) {
  box-shadow: inset 0 0 0 2px #d5e6ff;
}
.knowledge-editor :deep(pre) {
  background: #f0f4fa;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
}
.knowledge-editor :deep(blockquote) {
  border-left: 3px solid #aac7ed;
  padding-left: 14px;
  color: #62738c;
}
.editor-foot {
  padding: 9px 14px;
  color: #8190a6;
  font-size: 11px;
  border-top: 1px solid #edf1f7;
}
.knowledge-editor textarea {
  border: 0;
  border-radius: 0;
  width: 100%;
  box-sizing: border-box;
}
.knowledge-editor > .muted,
.knowledge-editor > .error {
  padding: 0 14px;
}
</style>
