/**
 * 统一的事件监听抽象层
 *
 * 云端架构下，Tauri 后端不再 emit 业务事件。
 * 但旧 UI 已经通过 listenEvent 消费打字机片段，所以这里用浏览器
 * CustomEvent 做一层轻量兼容，让 SSE chunk 仍能推到现有组件。
 */

type UnlistenFn = () => void;

/**
 * 监听事件 — 在云端架构中统一返回 no-op
 * 流式事件由 api-client 的 streamRequest 的 onChunk 回调实现
 */
export async function listenEvent(
  event: string,
  handler: (payload: any) => void
): Promise<UnlistenFn> {
  const listener = (nativeEvent: Event) => {
    handler((nativeEvent as CustomEvent).detail);
  };
  window.addEventListener(event, listener as EventListener);
  return () => window.removeEventListener(event, listener as EventListener);
}

export function emitBridgeEvent(event: string, payload: any): void {
  window.dispatchEvent(new CustomEvent(event, { detail: payload }));
}
