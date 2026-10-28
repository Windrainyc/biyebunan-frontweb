/** 只接纳最新读取的结果；关闭弹窗或卸载时使所有在途读取失效，不取消任何业务写入。 */
export function latestRequest() {
  let sequence = 0;
  return {
    start() {
      const current = ++sequence;
      return () => current === sequence;
    },
    invalidate() {
      sequence++;
    },
  };
}
