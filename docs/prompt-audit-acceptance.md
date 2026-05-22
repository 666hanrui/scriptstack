# Prompt Audit Acceptance Protocol

This document defines the Stage 3 prompt provenance acceptance process. Compile success is not enough.

## Authority source

The authority source is:

```text
original-prompt-archive/manifest.json
original-prompt-archive/raw-original/
```

The active runtime prompt directory is:

```text
src-tauri/src/llm/prompts/
```

The active prompt files must match the raw-original archive byte-for-byte.

## Generate and verify the active manifest

Run from repository root:

```bash
npm run prompt:manifest
```

This updates:

```text
src-tauri/src/llm/prompts/manifest.json
```

The generator reads the archive manifest, loads each raw-original file, then compares it with the active prompt file.

The script computes:

```text
activeSha256
rawSha256
archiveSha256
rawMatchesArchive
exactMatch
byteSize
rawByteSize
lineCount
literalNewlineCount
auditStatus
```

The script fails unless all 23 active prompts match the raw-original bytes.

Expected success line:

```text
prompt archive verification passed: 23/23 active prompts match raw-original bytes
```

## Commit the generated manifest

```bash
git diff -- src-tauri/src/llm/prompts/manifest.json
git add src-tauri/src/llm/prompts/manifest.json
git commit -m "chore(prompts): refresh prompt manifest hashes"
```

Do not manually fill hashes.

## Literal backslash-n rule

Some original prompts intentionally contain literal `\\n` sequences. Do not normalize them into real line breaks unless the raw-original archive changes. Byte equality against raw-original is the only acceptance standard.

## Runtime prompt dump proof

Run real app actions that trigger model calls. Then verify:

```bash
PROMPT_AUDIT_DIR="${SCRIPTSTACK_PROMPT_AUDIT_DIR:-$HOME/Library/Application Support/ScriptStack/debug-prompts}"
ls "$PROMPT_AUDIT_DIR"
cat "$PROMPT_AUDIT_DIR/prompt_hash_index.jsonl" | tail -20
```

Expected output exists for these chains:

```text
workflow step
workflow selfcheck
workflow checkpoint
script planning
script writing
script review
asset character
asset scene
asset prop
prompt segment planning
prompt seedance scene
seedance phase ad
seedance unit efg
```

Each `prompt_hash_index.jsonl` row should contain:

```text
promptHash
promptFile
promptSlug or contextType
command
model
maxTokens
dumpFile
createdAtEpochMs
```

## Failure record format

```text
Chain:
Expected prompt file:
Actual prompt file:
Prompt slug/context type:
Archive sha256:
Active sha256:
Runtime promptHash:
Dump file:
Observed problem:
Fix commit:
```

## Current non-pass items

```text
src-tauri/src/llm/prompts/manifest.json must be regenerated locally after pulling the generator.
runtime audit is not accepted until prompt_hash_index.jsonl is produced by real model calls.
```
