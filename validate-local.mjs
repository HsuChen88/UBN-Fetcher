/**
 * 階段 1：本地統一編號檢查碼驗證
 *
 * 讀取 company_info_all.csv，只執行本地演算法驗證，
 * 不呼叫任何遠端 API，速度最快。
 *
 * 輸出：results-local.json
 * 用法：node validate-local.mjs [csv檔案路徑]
 */

import { writeFileSync } from "fs";
import { readUBNsFromCSV } from "./lib/csv.mjs";
import { validateChecksum } from "./lib/checksum.mjs";

const CSV_FILE = process.argv[2] ?? "company_info_all.csv";
const OUTPUT_FILE = "results-local.json";

// 讀取並去重
const rawUBNs = readUBNsFromCSV(CSV_FILE);
const uniqueUBNs = [...new Set(rawUBNs.map((u) => String(u).padStart(8, "0")))];
const duplicates = rawUBNs.length - uniqueUBNs.length;

console.log("統一編號本地檢查碼驗證\n" + "=".repeat(60));
console.log(`來源檔案: ${CSV_FILE}`);
console.log(`原始筆數: ${rawUBNs.length}，去重後: ${uniqueUBNs.length}（移除 ${duplicates} 筆重複）\n`);

const results = uniqueUBNs.map((ban) => {
  const valid = validateChecksum(ban);
  return { ban, checksumValid: valid };
});

const passCount = results.filter((r) => r.checksumValid).length;
const failCount = results.length - passCount;

console.log(`合法: ${passCount} 筆  |  不合法: ${failCount} 筆\n`);

for (const r of results) {
  const mark = r.checksumValid ? "✓" : "✗";
  const label = r.checksumValid ? "合法  " : "不合法";
  console.log(`[${mark} ${label}] BAN: ${r.ban}`);
}

writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
console.log("\n" + "=".repeat(60));
console.log(`結果已寫入 → ${OUTPUT_FILE}\n`);
