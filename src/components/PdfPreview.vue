<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFDocumentLoadingTask,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl + '?module=1';
const props = defineProps<{ url: string; compact?: boolean }>();
const canvas = ref<HTMLCanvasElement>(),
  page = ref(1),
  pages = ref(0),
  busy = ref(true),
  error = ref('');
let pdf: PDFDocumentProxy | undefined,
  task: PDFDocumentLoadingTask | undefined,
  renderTask: RenderTask | undefined;
let disposed = false;
const controller = new AbortController();
async function render() {
  if (!pdf || !canvas.value || disposed) return;
  busy.value = true;
  try {
    const documentPage = await pdf.getPage(page.value);
    if (disposed || !canvas.value) return;
    const base = documentPage.getViewport({ scale: 1 });
    const scale = Math.min((props.compact ? 400 : 1200) / base.width, 1600 / base.height, 2);
    const viewport = documentPage.getViewport({ scale });
    canvas.value.width = Math.ceil(viewport.width);
    canvas.value.height = Math.ceil(viewport.height);
    renderTask = documentPage.render({
      canvas: canvas.value,
      canvasContext: canvas.value.getContext('2d')!,
      viewport,
    });
    await renderTask.promise;
  } catch {
    if (!disposed) error.value = 'PDF页面暂无法显示，请下载查看';
  } finally {
    if (!disposed) busy.value = false;
  }
}
onMounted(async () => {
  try {
    const data = await (await fetch(props.url, { signal: controller.signal })).arrayBuffer();
    if (disposed) return;
    // 只绘制页面，不执行PDF脚本、表单动作或嵌入链接。
    task = getDocument({ data, useSystemFonts: true });
    pdf = await task.promise;
    if (disposed) return;
    pages.value = pdf.numPages;
    await render();
  } catch {
    if (!disposed) {
      error.value = 'PDF暂无法预览，请下载查看';
      busy.value = false;
    }
  }
});
onBeforeUnmount(() => {
  disposed = true;
  controller.abort();
  renderTask?.cancel();
  void task?.destroy();
});
</script>
<template>
  <div class="pdf-preview">
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="pdf-sheet">
      <canvas ref="canvas" role="img" :aria-label="'PDF第' + page + '页'" />
    </div>
    <p v-if="busy" role="status">正在渲染文档…</p>
    <nav v-if="!compact && pages" aria-label="PDF翻页">
      <button
        type="button"
        class="button"
        :disabled="busy || page <= 1"
        @click="
          page--;
          render();
        "
      >
        上一页</button
      ><span>{{ page }} / {{ pages }}</span
      ><button
        type="button"
        class="button"
        :disabled="busy || page >= pages"
        @click="
          page++;
          render();
        "
      >
        下一页
      </button>
    </nav>
  </div>
</template>
<style scoped>
.pdf-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 0;
  color: #63718b;
  font-size: 12px;
}
.pdf-sheet {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  overflow: auto;
  display: grid;
  place-items: center;
}
canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: white;
}
nav {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 8px;
}
</style>
