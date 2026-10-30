/** 复杂既有语法保留源码编辑，避免基础可视化扩展静默丢失内容。 */
export function requiresMarkdownSource(value: string): boolean {
  const withoutCode = value.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  return /!\[|<\/?[A-Za-z]|^\s*\|.*\||^\s*\[[^\]]+\]:|^\s*[-*+]\s+\[[ xX]\]|~~|^\s*\$\$/m.test(
    withoutCode,
  );
}
