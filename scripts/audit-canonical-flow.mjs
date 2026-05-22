#!/usr/bin/env node
import fs from "node:fs";

const manifestPath = "src-tauri/src/llm/prompts/manifest.json";
const backendContractPath = "src-tauri/src/llm/prompts.rs";
const frontendFlowPath = "frontend-src/src/pages/FlowMapPage.tsx";

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const backendContract = fs.readFileSync(backendContractPath, "utf8");
const frontendFlow = fs.readFileSync(frontendFlowPath, "utf8");

const usageKeys = manifest.files.map((item) => item.usageKey);
const missingInBackend = usageKeys.filter((usageKey) => !backendContract.includes(`"${usageKey}"`));
const missingInFrontend = usageKeys.filter((usageKey) => !frontendFlow.includes(`'${usageKey}'`) && !frontendFlow.includes(`"${usageKey}"`));
const backendEntryCount = (backendContract.match(/canonical_entry\(&files,/g) || []).length;
const frontendFallbackCount = (frontendFlow.match(/^\s+\['/gm) || []).length;
const exactMatches = Number(manifest.exactMatches || 0);
const failures = Array.isArray(manifest.failures) ? manifest.failures : [];

const problems = [];
if (manifest.total !== 23) problems.push(`manifest total expected 23, got ${manifest.total}`);
if (exactMatches !== 23) problems.push(`manifest exactMatches expected 23, got ${exactMatches}`);
if (failures.length) problems.push(`manifest failures expected 0, got ${failures.length}`);
if (backendEntryCount !== 23) problems.push(`backend canonical flow expected 23 entries, got ${backendEntryCount}`);
if (frontendFallbackCount !== 23) problems.push(`frontend fallback flow expected 23 entries, got ${frontendFallbackCount}`);
if (missingInBackend.length) problems.push(`backend contract missing usage keys: ${missingInBackend.join(", ")}`);
if (missingInFrontend.length) problems.push(`frontend flow missing usage keys: ${missingInFrontend.join(", ")}`);

if (problems.length) {
  console.error("canonical flow audit failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("canonical flow audit passed: 23/23 original prompt usage keys are represented in backend contract and frontend flow page");
