/**
 * 階段 2b：經濟部商工行政資料開放平台 API 查詢
 *
 * 讀取 company_info_all.csv，先過濾本地檢查碼，
 * 再呼叫商工 API #49 確認登記型態。
 *
 * API: GET https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D
 *
 * 輸出：results-gcis.json
 * 用法：node validate-gcis.mjs [csv檔案路徑]
 */

import { writeFileSync } from "fs";
import { readUBNsFromCSV } from "./lib/csv.mjs";
import { validateChecksum } from "./lib/checksum.mjs";
import { checkByGCIS } from "./lib/api.mjs";
import { processBatch } from "./lib/batch.mjs";

const CSV_FILE = process.argv[2] ?? "company_info_all.csv";
const OUTPUT_FILE = "results-gcis.json";

// 讀取並去重
const rawUBNs = readUBNsFromCSV(CSV_FILE);
const uniqueUBNs = [...new Set(rawUBNs.map((u) => String(u).padStart(8, "0")))];
const duplicates = rawUBNs.length - uniqueUBNs.length;

console.log("統一編號驗證 — 商工 GCIS API\n" + "=".repeat(60));
console.log(`來源檔案: ${CSV_FILE}`);
console.log(`原始筆數: ${rawUBNs.length}，去重後: ${uniqueUBNs.length}（移除 ${duplicates} 筆重複）\n`);

// 本地檢查碼過濾
const checksumPass = uniqueUBNs.filter(validateChecksum);
const checksumFail = uniqueUBNs.filter((u) => !validateChecksum(u));
console.log(`[檢查碼] 合法: ${checksumPass.length} 筆  |  不合法: ${checksumFail.length} 筆`);
if (checksumFail.length > 0) {
  console.log(`  不合法號碼: ${checksumFail.join(", ")}`);
}
console.log();

// GCIS API 查詢
console.log(`開始 GCIS API 查詢 ${checksumPass.length} 筆…\n`);
const apiResults = await processBatch(checksumPass, async (ban) => {
  try {
    const result = await checkByGCIS(ban);
    return { ban, checksumValid: true, ...result };
  } catch (err) {
    return { ban, checksumValid: true, exists: null, source: "GCIS", error: err.message };
  }
});

// 組合最終結果（含未通過檢查碼的）
const allResults = [
  ...checksumFail.map((ban) => ({
    ban,
    checksumValid: false,
    exists: false,
    source: "GCIS",
    registeredTypes: [],
    raw: [],
  })),
  ...apiResults,
].sort((a, b) => a.ban.localeCompare(b.ban));

// 輸出到螢幕
for (const r of allResults) {
  if (!r.checksumValid) {
    console.log(`[✗ 格式錯誤] BAN: ${r.ban}  ← 檢查碼不符`);
    continue;
  }
  const status = r.exists ? "✓ 存在  " : r.exists === null ? "? 查詢失敗" : "✗ 未登記";
  console.log(`\n[${status}] BAN: ${r.ban}`);
  if (r.error) {
    console.log(`  GCIS → 查詢失敗: ${r.error}`);
  } else if (r.exists) {
    console.log(`  GCIS → 登記型態: ${r.registeredTypes.join(", ")}`);
  } else {
    console.log(`  GCIS → 未找到`);
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), "utf-8");
console.log("\n" + "=".repeat(60));
const existCount = allResults.filter((r) => r.exists === true).length;
console.log(`結果: ${existCount} / ${allResults.length} 筆 UBN 在 GCIS 登記中`);
console.log(`完整結果已寫入 → ${OUTPUT_FILE}\n`);
