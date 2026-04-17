/**
 * 台灣統一編號本地格式驗證（2023.04 修訂版）
 *
 * 演算法：
 *   權重 [1,2,1,2,1,2,4,1]，各位乘積若 ≥ 10 則拆兩位相加，
 *   總和 S % 5 == 0 為合法。
 *
 * 特例（2023.04）：
 *   第 7 碼 d_7 == 7 時，7×4=28 → 2+8=10 → 需再拆：1+0=1，
 *   等效於將 S 多加 1 後能被 5 整除：(S+1) % 5 == 0 亦合法。
 */
export function validateChecksum(ban) {
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
