import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTudouBridge } from "../hooks/useTudouBridge";
import { useAppStore } from "../store/useAppStore";
import { setSessionAuth } from "../lib/api-client";
import {
  Fingerprint,
  Lock,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Mail,
} from "lucide-react";

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    filter: "blur(10px)",
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
};

const shakeAnimation = {
  x: [0, -10, 10, -10, 10, 0],
  transition: { duration: 0.4, type: "tween" as const, ease: "easeInOut" as const },
};

export default function AuthModal() {
  const { invoke, isLoading } = useTudouBridge();
  const { user, setUser } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const syncBackendToken = async (token?: string, refreshToken?: string) => {
    if (!token) return;
    setSessionAuth(token, refreshToken || "");
    await invoke("auth/set-token", {
      token,
      refreshToken: refreshToken || "",
    }, { silent: true }).catch(() => undefined);
  };

  useEffect(() => {
    const probeAuth = async () => {
      try {
        if (user?.token) {
          await syncBackendToken(user.token, "");
        }
        const res = await invoke<{
          loggedIn: boolean;
          username?: string;
          token?: string;
          role?: string;
          isAdmin?: boolean;
        }>("auth/status", {}, { silent: true, hideGlobalError: true });
        if (!res.loggedIn) {
          if (user) setUser(null);
          setShowModal(true);
        } else if (res.loggedIn) {
          setUser({
            username: res.username || user?.username || "Creator",
            token: res.token || user?.token || "",
            role: res.role || user?.role || "user",
            isAdmin: Boolean(res.isAdmin ?? user?.isAdmin),
          });
          setShowModal(false);
        }
      } catch (err) {
        if (!user) setShowModal(true);
      }
    };
    probeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "register" && !email.trim()) {
      setErrorMsg("请输入邮箱地址");
      return;
    }

    try {
      const action = mode === "login" ? "auth/login" : "auth/register";
      const payload =
        mode === "login"
          ? { username, password }
          : { username, password, email: email.trim() };

      const res = await invoke<{
        token: string;
        refreshToken?: string;
        username?: string;
        role?: string;
        isAdmin?: boolean;
        error?: string;
      }>(action, payload);

      if (res.error) {
        setErrorMsg(res.error);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
        return;
      }

      await syncBackendToken(res.token, res.refreshToken || "");

      setUser({
        username: res.username || username,
        token: res.token,
        role: res.role || "user",
        isAdmin: Boolean(res.isAdmin),
      });
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "神经连接遭到拒绝");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setErrorMsg("");
  };

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
        >
          <div className="absolute w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />

          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate={isShaking ? shakeAnimation : "visible"}
            exit="exit"
            className="relative w-full max-w-[400px] p-10 rounded-[2.5rem] bg-[#0a0a0a]/80 border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="flex flex-col items-center mb-10 relative z-10">
              <div className="relative mb-6 group">
                <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-white shadow-inner">
                  <Fingerprint size={28} strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-widest mb-1">
                {mode === "login" ? "系统覆写" : "创建身份"}
              </h2>
              <p className="text-white/40 text-xs tracking-widest uppercase">
                {mode === "login"
                  ? "Identity Verification"
                  : "Initialize Local Profile"}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 relative z-10"
            >
              <div className="relative group">
                <UserIcon
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="接入标识 (Username)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white/90 text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                  required
                />
              </div>

              {mode === "register" && (
                <div className="relative group">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors"
                    size={18}
                  />
                  <input
                    type="email"
                    placeholder="电子邮箱 (Email)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white/90 text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                    required
                  />
                </div>
              )}

              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors"
                  size={18}
                />
                <input
                  type="password"
                  placeholder="安全密钥 (Password)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white/90 text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
                  required
                />
              </div>

              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl"
                  >
                    <AlertCircle size={14} />
                    {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="mt-2 relative w-full h-12 flex items-center justify-center rounded-2xl bg-white text-black font-bold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:bg-white/10 disabled:text-white/40 overflow-hidden group"
              >
                {!isLoading && (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                )}
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin text-white/70" />
                ) : mode === "login" ? (
                  "建立连接"
                ) : (
                  "创建并连接"
                )}
              </button>

              <button
                type="button"
                onClick={toggleMode}
                className="text-white/30 hover:text-white/60 text-xs tracking-widest transition-colors"
              >
                {mode === "login"
                  ? "没有账号？创建本地账号"
                  : "已有账号？返回登录"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
