import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initFileSrc } from "./lib/file-src";
import "./styles.css";

// 初始化文件路径转换（Tauri / HTTP 双模式）
initFileSrc();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
