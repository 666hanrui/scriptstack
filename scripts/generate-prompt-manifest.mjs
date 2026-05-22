import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");
const promptsDir = join(repoRoot, "src-tauri", "src", "llm", "prompts");
const activeManifestPath = join(promptsDir, "manifest.json");
const archiveRoot = join(repoRoot, "original-prompt-archive");
const archiveManifestPath = join(archiveRoot, "manifest.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function countLiteralNewlines(text) {
  return (text.match(/\\n/g) || []).length;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

if (!existsSync(archiveManifestPath)) {
  console.error("missing original prompt archive manifest:", relative(repoRoot, archiveManifestPath));
  process.exit(1);
}

const archiveManifest = readJson(archiveManifestPath);
const archiveFiles = Array.isArray(archiveManifest.files) ? archiveManifest.files : [];
if (archiveFiles.length !== 23) {
  console.error(`expected 23 archived prompts, found ${archiveFiles.length}`);
  process.exit(1);
}

const files = archiveFiles.map((source) => {
  const activePath = join(repoRoot, source.sourcePath);
  const rawPath = join(archiveRoot, source.archivePath);
  const activeExists = existsSync(activePath);
  const rawExists = existsSync(rawPath);
  const activeBytes = activeExists ? readFileSync(activePath) : Buffer.alloc(0);
  const rawBytes = rawExists ? readFileSync(rawPath) : Buffer.alloc(0);
  const activeSha256 = activeExists ? sha256(activeBytes) : null;
  const rawSha256 = rawExists ? sha256(rawBytes) : null;
  const archiveSha256 = source.sha256 || null;
  const rawMatchesArchive = rawExists && rawSha256 === archiveSha256;
  const exactMatch = activeExists && rawExists && Buffer.compare(activeBytes, rawBytes) === 0;
  const activeText = activeBytes.toString("utf8");

  return {
    file: source.file,
    category: source.category,
    stage: source.stage,
    usageKey: source.usageKey,
    sourceCommit: source.sourceCommit,
    sourceCommitSubject: source.sourceCommitSubject,
    originalSourcePath: source.sourcePath,
    rawArchivePath: `original-prompt-archive/${source.archivePath}`,
    activePath: source.sourcePath,
    callEntry: source.usageKey?.startsWith("contextType=") ? "request_contextual_llm_stream" : "request_prompt_llm",
    contextType: source.usageKey?.startsWith("contextType=") ? source.usageKey.replace("contextType=", "") : null,
    promptSlug: source.usageKey?.startsWith("promptSlug=") ? source.usageKey.replace("promptSlug=", "") : null,
    activeExists,
    rawExists,
    byteSize: activeBytes.length,
    rawByteSize: rawBytes.length,
    activeSha256,
    rawSha256,
    archiveSha256,
    rawMatchesArchive,
    exactMatch,
    exactMatchSource: "original-prompt-archive/raw-original",
    diffReason: exactMatch ? null : "active prompt bytes differ from raw-original archive",
    lineCount: activeExists ? activeText.split(/\r?\n/).length : 0,
    literalNewlineCount: activeExists ? countLiteralNewlines(activeText) : 0,
    hasLiteralEscapedNewlines: source.hasLiteralEscapedNewlines,
    firstSeenInHistory: source.firstSeenInHistory,
    note: source.note,
    auditStatus: activeExists && rawExists && rawMatchesArchive && exactMatch ? "ok" : "failed"
  };
});

const manifest = {
  version: 3,
  generatedBy: "scripts/generate-prompt-manifest.mjs",
  generatedAt: new Date().toISOString(),
  authority: "original-prompt-archive/manifest.json + original-prompt-archive/raw-original",
  archiveCreatedAt: archiveManifest.createdAt,
  primaryOriginalCommit: archiveManifest.primaryOriginalCommit,
  v3AddedPromptCommit: archiveManifest.v3AddedPromptCommit,
  promptDir: "src-tauri/src/llm/prompts",
  total: files.length,
  exactMatches: files.filter((file) => file.exactMatch).length,
  failures: files.filter((file) => file.auditStatus !== "ok").map((file) => ({
    file: file.file,
    activePath: file.activePath,
    rawArchivePath: file.rawArchivePath,
    activeSha256: file.activeSha256,
    rawSha256: file.rawSha256,
    archiveSha256: file.archiveSha256,
    activeExists: file.activeExists,
    rawExists: file.rawExists,
    rawMatchesArchive: file.rawMatchesArchive,
    exactMatch: file.exactMatch,
    diffReason: file.diffReason
  })),
  files
};

writeFileSync(activeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`prompt manifest written: ${relative(repoRoot, activeManifestPath)}`);
console.log(`archive prompts: ${files.length}`);
console.log(`exact matches: ${manifest.exactMatches}/${manifest.total}`);
if (manifest.failures.length > 0) {
  console.error("prompt archive verification failed:");
  for (const failure of manifest.failures) {
    console.error(JSON.stringify(failure, null, 2));
  }
  process.exit(1);
}
console.log("prompt archive verification passed: 23/23 active prompts match raw-original bytes");
