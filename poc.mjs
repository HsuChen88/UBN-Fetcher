/**
 * UBN Validator PoC
 *
 * 從 company_info.csv 讀取統一編號清單，執行兩階段驗證：
 *
 * 階段 1（本地）：台灣統一編號檢查碼演算法
 *   - 權重 [1,2,1,2,1,2,4,1] 加權交叉相加，總和需能被 5 整除
 *   - 第 7 碼為 7 時，(sum-1) % 5 == 0 亦合法
 *
 * 階段 2（遠端）：使用兩個公開 API 查詢是否真實登記
 *   1. 財政部財政資訊中心 - 全國營業(稅籍)登記資料
 *      GET https://eip.fia.gov.tw/OAI/api/businessRegistration/{ban}
 *      HTTP 200 + 有資料 → 存在；HTTP 404 → 未登記
 *
 *   2. 經濟部商工行政資料開放平台 - API #49 統編查公司/分公司/商業
 *      GET https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D
 *      任一 TYPE 的 exist 為 "Y" → 存在；全為 "N" → 未登記
 */

import { readFileSync, writeFileSync } from "fs";

const FIA_BASE = "https://eip.fia.gov.tw/OAI/api/businessRegistration";
const GCIS_API49 =
  "https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D";

// === 讀取 CSV（忽略 header，移除引號與空白行）===
function readUBNsFromCSV(filePath) {
  const lines = readFileSync(filePath, "utf-8").trim().split("\n");
  return lines
    .slice(1)
    .map((l) => l.trim().replace(/"/g, ""))
    .filter((l) => l.length > 0);
}

// === 台灣統一編號本地格式驗證 ===
// 權重 [1,2,1,2,1,2,4,1]，各位乘積若 ≥10 則拆兩位相加，總和 % 5 == 0 為合法
// 特例：第 7 碼 == 7 時，(sum-1) % 5 == 0 亦合法
function validateChecksum(ban) {
  if (!/^\d{8}$/.test(ban)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const digits = ban.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const p = digits[i] * weights[i];
    sum += Math.floor(p / 10) + (p % 10);
  }
  if (sum % 5 === 0) return true;
  if (digits[6] === 7 && (sum + 1) % 5 === 0) return true;
  return false;
}

// 用財政部稅籍 API 查詢（主要方法，免申請）
async function checkByFIA(ban) {
  const url = `${FIA_BASE}/${ban}`;
  const res = await fetch(url);
  if (res.status === 404) {
    return { exists: false, source: "FIA", data: null };
  }
  if (!res.ok) {
    throw new Error(`FIA API error: HTTP ${res.status} for BAN ${ban}`);
  }
  const data = await res.json();
  return {
    exists: !!data?.businessNm,
    source: "FIA",
    data: data
      ? {
          name: data.businessNm,
          type: data.businessType,
          address: data.businessAddress,
          setupDate: data.businessSetupDate,
          industry: data.industryNm,
        }
      : null,
  };
}

// 用商工 API #49 查詢（補充方法，確認登記型態）
async function checkByGCIS(ban) {
  const params = new URLSearchParams({
    $format: "json",
    $filter: `No eq ${ban}`,
    $skip: "0",
    $top: "50",
  });
  const url = `${GCIS_API49}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GCIS API error: HTTP ${res.status} for BAN ${ban}`);
  }
  const data = await res.json();
  // data 為 [{Year, exist, TYPE}, ...]
  const registeredTypes = data
    .filter((item) => item.exist === "Y")
    .map((item) => item.TYPE);
  return {
    exists: registeredTypes.length > 0,
    source: "GCIS",
    registeredTypes,
    raw: data,
  };
}

// 驗證單一 UBN（同時查兩個 API）
async function validateUBN(ban) {
  const padded = String(ban).padStart(8, "0");
  const [fia, gcis] = await Promise.allSettled([
    checkByFIA(padded),
    checkByGCIS(padded),
  ]);

  const fiaResult = fia.status === "fulfilled" ? fia.value : { error: fia.reason?.message };
  const gcisResult = gcis.status === "fulfilled" ? gcis.value : { error: gcis.reason?.message };

  // 只要任一 API 確認存在即視為存在
  const exists = fiaResult.exists === true || gcisResult.exists === true;

  return { ban: padded, exists, fia: fiaResult, gcis: gcisResult };
}

// 批次驗證一批 UBN，加入 concurrency 控制避免打爆 API
async function validateBatch(ubns, { concurrency = 5, delayMs = 200 } = {}) {
  const results = [];
  for (let i = 0; i < ubns.length; i += concurrency) {
    const chunk = ubns.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(validateUBN));
    results.push(...chunkResults);
    if (i + concurrency < ubns.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

// === 執行 ===
const OUTPUT_FILE = "results.json";
const CSV_FILE = "company_info_all.csv";

// 讀取並去重
const rawUBNs = readUBNsFromCSV(CSV_FILE);
const uniqueUBNs = [...new Set(rawUBNs)];
const duplicates = rawUBNs.length - uniqueUBNs.length;

console.log("UBN 驗證\n" + "=".repeat(60));
console.log(`原始筆數: ${rawUBNs.length}，去重後: ${uniqueUBNs.length}（移除 ${duplicates} 筆重複）\n`);

// 階段 1：本地檢查碼驗算
const checksumPass = uniqueUBNs.filter(validateChecksum);
const checksumFail = uniqueUBNs.filter((u) => !validateChecksum(u));

console.log(`[檢查碼] 合法: ${checksumPass.length} 筆  |  不合法: ${checksumFail.length} 筆`);
if (checksumFail.length > 0) {
  console.log(`  不合法號碼: ${checksumFail.join(", ")}`);
}
console.log();

// 階段 2：API 查詢（只查通過檢查碼的）
console.log(`開始 API 查詢 ${checksumPass.length} 筆…\n`);
const apiResults = await validateBatch(checksumPass);

// 組合最終結果（含未通過檢查碼的）
const allResults = [
  ...checksumFail.map((ban) => ({ ban, checksumValid: false, exists: false, fia: null, gcis: null })),
  ...apiResults.map((r) => ({ ...r, checksumValid: true })),
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
    console.log(`  FIA   → 查詢失敗: ${r.fia.error}`);
  } else if (r.fia?.exists && r.fia?.data) {
    console.log(`  FIA   → ${r.fia.data.name} (${r.fia.data.type})`);
  } else {
    console.log(`  FIA   → 未找到`);
  }
  if (r.gcis?.error) {
    console.log(`  GCIS  → 查詢失敗: ${r.gcis.error}`);
  } else if (r.gcis?.exists) {
    console.log(`  GCIS  → 登記型態: ${r.gcis.registeredTypes.join(", ")}`);
  } else {
    console.log(`  GCIS  → 未找到`);
  }
}

// 輸出到 JSON 檔
writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2), "utf-8");

console.log("\n" + "=".repeat(60));
const existCount = allResults.filter((r) => r.exists).length;
console.log(`結果: ${existCount} / ${allResults.length} 筆 UBN 真實存在`);
console.log(`完整結果已寫入 → ${OUTPUT_FILE}\n`);
