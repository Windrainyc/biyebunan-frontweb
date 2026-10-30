/** 下拉选项快照；保持等值快照引用，防止DOM观察器与Vue渲染形成反馈循环。 */
export interface SelectOptionSnapshot {
  value: string;
  label: string;
  disabled: boolean;
}
export function stableSelectOptions(
  previous: SelectOptionSnapshot[],
  next: SelectOptionSnapshot[],
): SelectOptionSnapshot[] {
  return previous.length === next.length &&
    previous.every((item, index) => {
      const candidate = next[index];
      return (
        candidate?.value === item.value &&
        candidate.label === item.label &&
        candidate.disabled === item.disabled
      );
    })
    ? previous
    : next;
}
