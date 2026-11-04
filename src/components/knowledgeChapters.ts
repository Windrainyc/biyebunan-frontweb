// 按标题划分阅读章节，保留代码、表格与图片完整性。
export function knowledgeChapters(text: string) {
  const result: { title: string; text: string }[] = [];
  let lines: string[] = [],
    title = '正文',
    fence = '';
  const flush = () => {
    if (lines.join('\n').trim()) result.push({ title, text: lines.join('\n') });
    lines = [];
  };
  for (const line of text.split('\n')) {
    const code = line.match(/^\s*(`{3,}|~{3,})/);
    if (code) {
      if (!fence) fence = code[1]![0]!;
      else if (code[1]![0] === fence) fence = '';
    }
    const heading = !fence && line.match(/^#{1,2}\s+(.+)$/);
    if (heading) {
      flush();
      title = heading[1]!;
    }
    lines.push(line);
  }
  flush();
  return result.length ? result : [{ title: '正文', text: text }];
}
