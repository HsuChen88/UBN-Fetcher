import { readFileSync } from "fs";

/**
 * 從 CSV 讀取統一編號清單（忽略 header，移除引號與空白行）
 * CSV 格式：第一欄為統一編號，第一行為標頭
 */
export function readUBNsFromCSV(filePath) {
  const lines = readFileSync(filePath, "utf-8").trim().split("\n");
  return lines
    .slice(1)
    .map((l) => l.trim().replace(/"/g, ""))
    .filter((l) => l.length > 0);
}
