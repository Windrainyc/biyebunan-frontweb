/** 阅读视图只解析安全的基础 Markdown；原始 HTML 与图片始终按文本显示，不执行或自动联网。 */
export type InlineNode = {
  kind: 'text' | 'code' | 'strong' | 'em' | 'link';
  text: string;
  href?: string;
};
export type MarkdownBlock =
  | { kind: 'paragraph' | 'quote' | 'heading'; text: string; level?: number }
  | { kind: 'code'; text: string; language: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'rule' };
export function safeReadingLink(value: string): string | undefined {
  // 不接受协议相对、data/javascript、控制字符及其编码变种；外链只允许明确的HTTP(S)。
  if (/[^\S ]|[\x00-\x1f\x7f]/.test(value)) return;
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password)
      return url.href;
  } catch {
    /* 非绝对链接按原文保留。 */
  }
}
export function inlineMarkdown(text: string): InlineNode[] {
  const output: InlineNode[] = [];
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<!!)\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) output.push({ kind: 'text', text: text.slice(cursor, match.index) });
    if (match[1]) output.push({ kind: 'code', text: match[1] });
    else if (match[2]) output.push({ kind: 'strong', text: match[2] });
    else if (match[3]) output.push({ kind: 'em', text: match[3] });
    else {
      const href = safeReadingLink(match[5]!);
      output.push(
        href ? { kind: 'link', text: match[4]!, href } : { kind: 'text', text: match[0] },
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) output.push({ kind: 'text', text: text.slice(cursor) });
  return output;
}
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
const listItem = (line: string) => /^\s*(?:([-+*])|\d+[.)])\s+(.+)$/.exec(line);
export function markdownBlocks(input: string): MarkdownBlock[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const output: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index++;
      continue;
    }
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const content: string[] = [];
      index++;
      const closing = new RegExp('^\\s*' + fence[1]![0] + '{' + fence[1]!.length + ',}\\s*$');
      while (index < lines.length && !closing.test(lines[index]!)) content.push(lines[index++]!);
      if (index < lines.length) index++;
      output.push({ kind: 'code', text: content.join('\n'), language: fence[2]!.trim() });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      output.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! });
      index++;
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      output.push({ kind: 'rule' });
      index++;
      continue;
    }
    const next = lines[index + 1];
    if (
      line.includes('|') &&
      next?.includes('|') &&
      cells(next).every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const headers = cells(line),
        rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index]!.trim() && lines[index]!.includes('|')) {
        const row = cells(lines[index++]!);
        rows.push(headers.map((_, i) => row[i] || ''));
      }
      output.push({ kind: 'table', headers, rows });
      continue;
    }
    const item = listItem(line);
    if (item) {
      const ordered = !item[1],
        items: string[] = [];
      while (index < lines.length) {
        const current = listItem(lines[index]!);
        if (!current || !current[1] !== ordered) break;
        items.push(current[2]!);
        index++;
      }
      output.push({ kind: 'list', ordered, items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!))
        quote.push(lines[index++]!.replace(/^>\s?/, ''));
      output.push({ kind: 'quote', text: quote.join('\n') });
      continue;
    }
    const paragraph = [line];
    index++;
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^(?:#{1,6}\s|>|\s*`{3}|\s*~{3}|\s*[-+*]\s|\s*\d+[.)]\s)/.test(lines[index]!)
    ) {
      if (
        lines[index + 1]?.includes('|') &&
        cells(lines[index + 1]!).every((cell) => /^:?-{3,}:?$/.test(cell))
      )
        break;
      paragraph.push(lines[index++]!);
    }
    output.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }
  return output;
}
