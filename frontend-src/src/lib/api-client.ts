/**
 * ScriptStack HTTP API Client
 *
 * 当不在 Tauri 运行时中时，所有 IPC 调用走 HTTP POST /api/invoke
 * 流式响应走 SSE (Server-Sent Events)
 */

// 后端 API 地址：
// - 开发环境默认连接本地 Axum 服务。
// - 生产静态站默认走同源 /api，由 Nginx 反代到 127.0.0.1:3000。
// - 如需桌面客户端连接远端，可在构建时注入 VITE_API_BASE。
const env = (typeof import.meta !== "undefined" && (import.meta as any).env) || {};
const API_BASE = env?.VITE_API_BASE || (env?.DEV ? "http://localhost:3000" : "");
const SESSION_AUTH_KEY = "scriptstack-session-auth";

export function setSessionAuth(token?: string, refreshToken?: string) {
  try {
    if (!token) {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify({ token, refreshToken: refreshToken || "" }));
  } catch {
    // sessionStorage may be unavailable in hardened webviews.
  }
}

export function clearSessionAuth() {
  setSessionAuth("", "");
}

/** 获取存储的 JWT token */
function getToken(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.token) return session.token;
    }
  } catch {
    // Fall through to legacy storage cleanup.
  }
  try {
    const raw = localStorage.getItem("scriptstack-core-storage");
    if (!raw) return "";
    const store = JSON.parse(raw);
    return store?.state?.user?.token || "";
  } catch {
    return "";
  }
}

function clearStoredUser() {
  clearSessionAuth();
  try {
    const raw = localStorage.getItem("scriptstack-core-storage");
    if (!raw) return;
    const store = JSON.parse(raw);
    if (store?.state) {
      store.state.user = null;
      localStorage.setItem("scriptstack-core-storage", JSON.stringify(store));
    }
  } catch {
    // best effort only
  }
}

/** 通用 invoke — 调用 POST /api/invoke */
export async function httpInvoke<T = any>(
  cmd: string,
  args: Record<string, any> = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ cmd, args }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) clearStoredUser();
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth endpoints (不走 /api/invoke，直接走 /api/auth/*) ──

export async function authRegister(username: string, password: string, email: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const body = await res.json();
  return {
    ...body,
    refreshToken: body.refreshToken ?? body.refresh_token,
    isAdmin: body.isAdmin ?? body.is_admin ?? body.role === "admin",
  };
}

export async function authLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const body = await res.json();
  return {
    ...body,
    refreshToken: body.refreshToken ?? body.refresh_token,
    isAdmin: body.isAdmin ?? body.is_admin ?? body.role === "admin",
  };
}

export async function authRefresh(refreshToken: string) {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function authStatus() {
  const token = getToken();
  if (!token) return { loggedIn: false };
  const res = await fetch(`${API_BASE}/api/auth/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) clearStoredUser();
    return { loggedIn: false };
  }
  const body = await res.json();
  return {
    ...body,
    loggedIn: true,
    username: body.username,
    token,
    role: body.role || "user",
    isAdmin: body.isAdmin ?? body.is_admin ?? body.role === "admin",
  };
}

// ── File Upload (multipart) ──

export async function uploadFile(file: File): Promise<any> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── SSE streaming helper ──

export interface StreamOptions {
  /** SSE 端点路径（相对于 API_BASE） */
  endpoint: string;
  /** POST body */
  body: Record<string, any>;
  /** 每收到一个 chunk 回调 */
  onChunk: (chunk: string, data?: any) => void;
  /** 流结束时的回调 */
  onDone?: (fullText: string) => void;
  /** 出错时回调 */
  onError?: (error: Error) => void;
  /** AbortSignal（用于取消） */
  signal?: AbortSignal;
}

/**
 * 使用 fetch + ReadableStream 读取 SSE 流
 * 后端会以 text/event-stream 格式返回
 */
export async function streamRequest(opts: StreamOptions): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${opts.endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(opts.body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || `HTTP ${res.status}`);
    opts.onError?.(err);
    throw err;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        let parsed: any;
        try {
          parsed = JSON.parse(data);
        } catch {
          // 非 JSON data，直接当文本处理
          fullText += data;
          opts.onChunk(data);
          continue;
        }
        if (parsed.error) {
          const err = new Error(parsed.error);
          opts.onError?.(err);
          throw err;
        }
        if (parsed.done) {
          continue;
        }
        const chunk = parsed.chunk || parsed.text || parsed.content || "";
        if (chunk) {
          fullText += chunk;
          opts.onChunk(chunk, parsed);
        }
      }
    }
  }

  opts.onDone?.(fullText);
  return fullText;
}

export async function streamInvoke<T = any>(
  cmd: string,
  args: Record<string, any> = {},
  onChunk?: (chunk: string, data?: any) => void,
  signal?: AbortSignal
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ cmd, args }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) clearStoredUser();
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let finalResult: any = undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        fullText += data;
        onChunk?.(data);
        continue;
      }

      if (parsed.error) throw new Error(parsed.error);
      if (parsed.done) {
        finalResult = parsed.result;
        continue;
      }

      const chunk = parsed.chunk || parsed.text || parsed.content || "";
      if (chunk) {
        fullText += chunk;
        onChunk?.(chunk, parsed);
      }
    }
  }

  return (finalResult ?? fullText) as T;
}

/** 导出 API_BASE 供其他模块使用 */
export { API_BASE };
