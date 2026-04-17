/**
 * 階段 2a：財政部財政資訊中心 API 查詢
 *
 * 讀取 company_info_all.csv，先過濾本地檢查碼，
 * 再呼叫財政部稅籍 API 確認登記狀態。
 *
 * API: GET https://eip.fia.gov.tw/OAI/api/businessRegistration/{ban}
 *
 * 輸出：results-fia.json
 * 用法：node validate-fia.mjs [csv檔案路徑]
 */

import { writeFileSync } from "fs";
import { readUBNsFromCSV } from "./lib/csv.mjs";
import { validateChecksum } from "./lib/checksum.mjs";
import { checkByFIA } from "./lib/api.mjs";
import { processBatch } from "./lib/batch.mjs";

const CSV_FILE = process.argv[2] ?? "company_info_all.csv";
const OUTPUT_FILE = "results-fia.json";

// 讀取並去重
const rawUBNs = readUBNsFromCSV(CSV_FILE);
const uniqueUBNs = [...new Set(rawUBNs.map((u) => String(u).padStart(8, "0")))];
const duplicates = rawUBNs.length - uniqueUBNs.length;

console.log("統一編號驗證 — 財政部 FIA API\n" + "=".repeat(60));
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

// FIA API 查詢
console.log(`開始 FIA API 查詢 ${checksumPass.length} 筆…\n`);
const apiResults = await processBatch(checksumPass, async (ban) => {
  try {
    const result = await checkByFIA(ban);
    return { ban, checksumValid: true, ...result };
  } catch (err) {
    return { ban, checksumValid: true, exists: null, source: "FIA", error: err.message };
  }
});

// 組合最終結果（含未通過檢查碼的）
const allResults = [
  ...checksumFail.map((ban) => ({ ban, checksumValid: false, exists: false, source: "FIA", data: null })),
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
    console.log(`  FIA → 查詢失敗: ${r.error}`);
  } else if (r.exists && r.data) {
    console.log(`  FIA → ${r.data.name} (${r.data.type})`);
    if (r.data.address) console.log(`        地址: ${r.data.address}`);
    if (r.data.setupDate) console.log(`        設立日期: ${r.data.setupDate}`);
  } else {
    console.log(`  FIA → 未找到`);
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), "utf-8");
console.log("\n" + "=".repeat(60));
const existCount = allResults.filter((r) => r.exists === true).length;
console.log(`結果: ${existCount} / ${allResults.length} 筆 UBN 在 FIA 登記中`);
console.log(`完整結果已寫入 → ${OUTPUT_FILE}\n`);
