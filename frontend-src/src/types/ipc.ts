export interface IpcResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface AuthStatus {
  loggedIn: boolean;
  username?: string;
  token?: string;
}
