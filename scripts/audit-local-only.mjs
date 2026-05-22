import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

const INCLUDED_ROOTS = [
  "frontend-src",
  "src-tauri",
  "scripts",
  "docs",
];

const EXCLUDED_PATH_PARTS = [
  "node_modules",
  "dist",
  "target",
  ".git",
  "original-prompt-archive",
  "data/debug-prompts",
  "package-lock.json",
];

const HARD_CODED_ENDPOINT_RE = /https?:\/\/[^\s"'`<>]+/g;
const SECRET_RE = /(?:api[_-]?key|secret|token|password|refresh[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i;
const PROMPT_FALLBACK_RE = /你是专业助手|professional assistant|generic assistant/i;
const FILE_RE = /\.(ts|tsx|rs|mjs|js|json|md|txt|toml|html|css|scss|yml|yaml)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(repoRoot, full).replaceAll("\\", "/");
    if (EXCLUDED_PATH_PARTS.some((part) => rel.includes(part))) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (FILE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function isAllowedUrl(rel, url) {
  if (rel.endsWith("audit-local-only.mjs")) return true;
  if (rel.startsWith("docs/")) return true;
  if (rel.startsWith("src-tauri/gen/")) return true;
  if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) return true;
  if (rel === "frontend-src/src/pages/Settings.tsx" && (
    url === "https://api.deepseek.com/v1" ||
    url === "https://api.openai.com/v1" ||
    url === "https://api.anthropic.com/v1" ||
    url === "https://generativelanguage.googleapis.com/v1beta" ||
    url === "https://openrouter.ai/api/v1" ||
    url === "https://dashscope.aliyuncs.com/compatible-mode/v1"
  )) return true;
  if (rel === "src-tauri/src/db/crud.rs" && url.startsWith("https://example.com/")) return true;
  if (url.includes("github.com/") || url.includes("raw.githubusercontent.com/")) return true;
  if (url.includes("docs.github.com/")) return true;
  if (url === "http://www.w3.org/2000/svg") return true;
  if (url.includes("schema.tauri.app")) return true;
  if (url.includes("json-schema.org")) return true;
  return false;
}

const files = INCLUDED_ROOTS.flatMap((root) => walk(join(repoRoot, root)));
const findings = [];

for (const file of files) {
  const rel = relative(repoRoot, file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");

  for (const match of text.matchAll(HARD_CODED_ENDPOINT_RE)) {
    const url = match[0];
    if (!isAllowedUrl(rel, url)) {
      findings.push({ type: "hardcoded_endpoint", file: rel, line: lineNumber(text, match.index ?? 0), value: url });
    }
  }

  const secret = SECRET_RE.exec(text);
  if (secret && !rel.endsWith("audit-local-only.mjs")) {
    findings.push({ type: "possible_secret_literal", file: rel, line: lineNumber(text, secret.index ?? 0), value: secret[0].slice(0, 120) });
  }

  const fallback = PROMPT_FALLBACK_RE.exec(text);
  if (fallback && rel.includes("prompts")) {
    findings.push({ type: "generic_prompt_fallback", file: rel, line: lineNumber(text, fallback.index ?? 0), value: fallback[0] });
  }
}

console.log(`local-only audit scanned ${files.length} files`);
if (findings.length) {
  console.error("local-only audit failed:");
  for (const item of findings) console.error(JSON.stringify(item));
  process.exit(1);
}
console.log("local-only audit passed: no disallowed hardcoded endpoints, obvious secrets, or generic prompt fallback detected");
