<script lang="ts">
import { defineComponent, h } from 'vue';
import { markdownBlocks, inlineMarkdown } from '../config/markdown';
/** 全部正文通过Vue文本节点输出，不使用v-html，保留不支持语法的原文。 */
export default defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    const inline = (text: string) =>
      inlineMarkdown(text).map((node) =>
        node.kind === 'text'
          ? node.text
          : h(
              node.kind === 'link' ? 'a' : node.kind,
              node.kind === 'link'
                ? { href: node.href, target: '_blank', rel: 'noopener noreferrer' }
                : {},
              node.text,
            ),
      );
    return () =>
      h(
        'div',
        { class: 'reading-prose' },
        markdownBlocks(props.text).map((block) => {
          if (block.kind === 'rule') return h('hr');
          if (block.kind === 'code') return h('pre', [h('code', block.text)]);
          if (block.kind === 'list')
            return h(
              block.ordered ? 'ol' : 'ul',
              block.items.map((item) => h('li', inline(item))),
            );
          if (block.kind === 'table')
            return h('div', { class: 'reading-table' }, [
              h('table', [
                h('thead', [
                  h(
                    'tr',
                    block.headers.map((cell) => h('th', { scope: 'col' }, inline(cell))),
                  ),
                ]),
                h(
                  'tbody',
                  block.rows.map((row) =>
                    h(
                      'tr',
                      row.map((cell) => h('td', inline(cell))),
                    ),
                  ),
                ),
              ]),
            ]);
          return h(
            block.kind === 'heading'
              ? 'h' + Math.min(6, (block.level || 1) + 1)
              : block.kind === 'quote'
                ? 'blockquote'
                : 'p',
            inline(block.text),
          );
        }),
      );
  },
});
</script>
<style>
.reading-prose {
  color: #40506a;
  line-height: 1.95;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.reading-prose p {
  margin: 0 0 18px;
  white-space: pre-wrap;
}
.reading-prose h2,
.reading-prose h3,
.reading-prose h4 {
  color: #172b4c;
  margin: 26px 0 12px;
  line-height: 1.5;
}
.reading-prose h2 {
  font-size: 22px;
}
.reading-prose h3 {
  font-size: 18px;
}
.reading-prose ul,
.reading-prose ol {
  padding-left: 24px;
}
.reading-prose li {
  margin: 6px 0;
}
.reading-prose a {
  color: #3158cc;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.reading-prose code {
  font-family: ui-monospace, monospace;
  background: #f0f3fa;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 0.9em;
}
.reading-prose pre {
  overflow: auto;
  padding: 18px;
  border-radius: 10px;
  background: #16233c;
  color: #e5ecff;
  line-height: 1.7;
}
.reading-prose pre code {
  color: inherit;
  background: none;
  padding: 0;
}
.reading-prose blockquote {
  border-left: 3px solid #7791d6;
  background: #f6f8fe;
  padding: 14px 18px;
  margin: 20px 0;
  white-space: pre-wrap;
}
.reading-prose hr {
  border: 0;
  border-top: 1px solid #e6ebf3;
  margin: 24px 0;
}
.reading-table {
  overflow-x: auto;
  margin: 20px 0;
}
.reading-table table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
.reading-table th,
.reading-table td {
  padding: 10px 14px;
  border: 1px solid #e4e9f2;
  text-align: left;
}
.reading-table th {
  background: #f5f7fb;
}
</style>
