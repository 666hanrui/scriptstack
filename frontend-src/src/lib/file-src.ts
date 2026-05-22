/**
 * 统一的文件路径转换
 *
 * Tauri 模式：使用 asset:// protocol
 * HTTP 模式：通过 API 文件接口代理
 */
import { API_BASE } from './api-client';

// 缓存 Tauri 的 convertFileSrc 函数引用，避免每次调用都检测
let _tauriConvertFileSrc: ((path: string) => string) | null | undefined = undefined;

function isTauriRuntime() {
  return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * 初始化 Tauri convertFileSrc 缓存（异步调用一次）
 * 在应用启动时调用此函数即可
 */
export async function initFileSrc(): Promise<void> {
  if (!isTauriRuntime()) {
    _tauriConvertFileSrc = null;
    return;
  }
  try {
    const mod = await import('@tauri-apps/api/core');
    _tauriConvertFileSrc = mod.convertFileSrc;
  } catch {
    _tauriConvertFileSrc = null;
  }
}

/**
 * 同步地将服务端文件路径转换为可用 URL。
 *
 * 云端模式下 asset_images 存在 src-server / Linux 服务器上，即使运行在
 * Tauri 桌面壳里也不能用 convertFileSrc 读取本机路径；必须统一走
 * /api/files 由服务端代理读取。
 */
export function resolveFileSrc(filePath: string): string {
  if (!filePath) return '';
  if (/^(https?:|data:|blob:|asset:)/i.test(filePath)) return filePath;
  return `${API_BASE}/api/files?path=${encodeURIComponent(filePath)}`;
}
