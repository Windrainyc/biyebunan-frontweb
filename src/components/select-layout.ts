/** 将菜单限制在视口安全边距内；窄触发器不应让完整选项挤成多行。 */
export function selectLayout(
  rect: { left: number; top: number; bottom: number; width: number },
  viewport: { width: number; height: number },
) {
  const margin = 8;
  const width = Math.max(0, Math.min(Math.max(rect.width, 220), viewport.width - margin * 2));
  const below = Math.max(0, viewport.height - rect.bottom - margin - 6);
  const above = Math.max(0, rect.top - margin - 6);
  return {
    left: `${Math.max(margin, Math.min(rect.left, viewport.width - width - margin))}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(280, Math.max(below, above))}px`,
    ...(below >= Math.min(280, above)
      ? { top: `${rect.bottom + 6}px` }
      : { bottom: `${viewport.height - rect.top + 6}px` }),
  };
}
