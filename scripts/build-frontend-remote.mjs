import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const viteBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const apiBase = process.env.VITE_API_BASE || "http://49.235.153.151";

const child = spawn(viteBin, ["build", "--config", "frontend-src/vite.config.ts"], {
  cwd: root,
  env: {
    ...process.env,
    VITE_API_BASE: apiBase,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
