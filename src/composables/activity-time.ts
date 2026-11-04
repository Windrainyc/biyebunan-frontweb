/** 活跃片段只估计可见、有焦点且最近一分钟有交互的时间；单次最多5秒。 */
export function activeSeconds(
  elapsedMs: number,
  visible: boolean,
  focused: boolean,
  idleMs: number,
): number {
  if (
    !visible ||
    !focused ||
    idleMs >= 60000 ||
    idleMs < 0 ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  )
    return 0;
  return Math.min(5, elapsedMs / 1000);
}
