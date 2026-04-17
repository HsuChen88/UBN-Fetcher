/**
 * 完整三階段 UBN 驗證
 *
 * 階段 1（本地）：檢查碼演算法（2023.04 修訂版）
 * 階段 2a（遠端）：財政部財政資訊中心 FIA API
 * 階段 2b（遠端）：經濟部商工行政資料開放平台 GCIS API #49
 *
 * 只要任一遠端 API 確認存在即視為存在。
 *
 * 輸出：results-all.json
 * 用法：node validate-all.mjs [csv檔案路徑]
 */

import { writeFileSync } from "fs";
import { readUBNsFromCSV } from "./lib/csv.mjs";
import { validateChecksum } from "./lib/checksum.mjs";
import { checkByFIA, checkByGCIS } from "./lib/api.mjs";
import { processBatch } from "./lib/batch.mjs";

const CSV_FILE = process.argv[2] ?? "company_info_all.csv";
const OUTPUT_FILE = "results-all.json";

// 讀取並去重
const rawUBNs = readUBNsFromCSV(CSV_FILE);
const uniqueUBNs = [...new Set(rawUBNs.map((u) => String(u).padStart(8, "0")))];
const duplicates = rawUBNs.length - uniqueUBNs.length;

console.log("統一編號完整驗證（本地 + FIA + GCIS）\n" + "=".repeat(60));
console.log(`來源檔案: ${CSV_FILE}`);
console.log(`原始筆數: ${rawUBNs.length}，去重後: ${uniqueUBNs.length}（移除 ${duplicates} 筆重複）\n`);

// 階段 1：本地檢查碼過濾
const checksumPass = uniqueUBNs.filter(validateChecksum);
const checksumFail = uniqueUBNs.filter((u) => !validateChecksum(u));
console.log(`[檢查碼] 合法: ${checksumPass.length} 筆  |  不合法: ${checksumFail.length} 筆`);
if (checksumFail.length > 0) {
  console.log(`  不合法號碼: ${checksumFail.join(", ")}`);
}
console.log();

// 階段 2：API 查詢（同時呼叫兩個 API）
console.log(`開始 API 查詢 ${checksumPass.length} 筆…\n`);
const apiResults = await processBatch(checksumPass, async (ban) => {
  const [fia, gcis] = await Promise.allSettled([checkByFIA(ban), checkByGCIS(ban)]);

  const fiaResult =
    fia.status === "fulfilled" ? fia.value : { exists: null, error: fia.reason?.message };
  const gcisResult =
    gcis.status === "fulfilled" ? gcis.value : { exists: null, error: gcis.reason?.message };

  const exists = fiaResult.exists === true || gcisResult.exists === true;
  return { ban, checksumValid: true, exists, fia: fiaResult, gcis: gcisResult };
});

// 組合最終結果（含未通過檢查碼的）
const allResults = [
  ...checksumFail.map((ban) => ({
    ban,
    checksumValid: false,
    exists: false,
    fia: null,
    gcis: null,
  })),
  ...apiResults,
].sort((a, b) => a.ban.localeCompare(b.ban));

// 輸出到螢幕
for (const r of allResults) {
  if (!r.checksumValid) {
    console.log(`[✗ 格式錯誤] BAN: ${r.ban}  ← 檢查碼不符`);
    continue;
  }
  const status = r.exists ? "✓ 存在  " : "✗ 未登記";
  console.log(`\n[${status}] BAN: ${r.ban}`);
  if (r.fia?.error) {
    console.log(`  FIA  → 查詢失敗: ${r.fia.error}`);
  } else if (r.fia?.exists && r.fia?.data) {
    console.log(`  FIA  → ${r.fia.data.name} (${r.fia.data.type})`);
  } else {
    console.log(`  FIA  → 未找到`);
  }
  if (r.gcis?.error) {
    console.log(`  GCIS → 查詢失敗: ${r.gcis.error}`);
  } else if (r.gcis?.exists) {
    console.log(`  GCIS → 登記型態: ${r.gcis.registeredTypes.join(", ")}`);
  } else {
    console.log(`  GCIS → 未找到`);
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), "utf-8");
console.log("\n" + "=".repeat(60));
const existCount = allResults.filter((r) => r.exists).length;
console.log(`結果: ${existCount} / ${allResults.length} 筆 UBN 真實存在`);
console.log(`完整結果已寫入 → ${OUTPUT_FILE}\n`);
