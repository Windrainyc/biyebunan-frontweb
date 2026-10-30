/** 仅允许可安全渲染的媒体；HTML、SVG和未知格式只能下载。 */
export function previewKind(mime: string) {
  if (/^image\/(png|jpeg|gif|webp|avif)$/.test(mime)) return 'image';
  if (/^video\/(mp4|webm|ogg)$/.test(mime)) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (/^text\/(plain|csv)$/.test(mime)) return 'text';
  return 'file';
}
export function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
}
/** 下载响应强制为附件。受限读取后按白名单类型创建临时预览，禁止执行上传脚本。 */
export async function previewBlob(url: string, mime: string, signal: AbortSignal) {
  if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('预览地址无效');
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error('预览加载失败，请重试');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 20 * 1024 * 1024) throw new Error('文件超过20MB，请下载查看');
      chunks.push(new Uint8Array(part.value));
    }
  } finally {
    await reader.cancel();
  }
  return new Blob(chunks, { type: mime });
}
