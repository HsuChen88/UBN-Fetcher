const FIA_BASE = "https://eip.fia.gov.tw/OAI/api/businessRegistration";
const GCIS_API49 =
  "https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D";

/**
 * 財政部財政資訊中心 - 全國營業(稅籍)登記資料
 * GET /businessRegistration/{ban}
 * HTTP 200 + 有資料 → 存在；HTTP 404 → 未登記
 */
export async function checkByFIA(ban) {
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

/**
 * 經濟部商工行政資料開放平台 - API #49 統編查公司/分公司/商業
 * 任一 TYPE 的 exist 為 "Y" → 存在；全為 "N" → 未登記
 */
export async function checkByGCIS(ban) {
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
