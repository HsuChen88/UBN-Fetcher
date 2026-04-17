/**
 * 本地 Proxy Server
 *
 * 用途：解決瀏覽器 CORS 限制，代理轉發財政部 FIA 與商工 GCIS API 請求
 * 用法：node server.mjs
 * 預設：http://localhost:3000
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

const PORT = 3000;
const FIA_BASE =
  "https://eip.fia.gov.tw/OAI/api/businessRegistration";
const GCIS_BASE =
  "https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D";

function proxyFetch(targetUrl, res) {
  const url = new URL(targetUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "UBN-Fetcher/1.0",
    },
  };

  const proxyReq = httpsRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  });

  proxyReq.end();
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    });
    res.end();
    return;
  }

  // 首頁 → 回傳 index.html
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = readFileSync("./index.html", "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end("找不到 index.html");
    }
    return;
  }

  // /api/fia/:ban  → 財政部稅籍 API
  const fiaMatch = url.pathname.match(/^\/api\/fia\/(\d{1,8})$/);
  if (fiaMatch) {
    proxyFetch(`${FIA_BASE}/${fiaMatch[1]}`, res);
    return;
  }

  // /api/gcis?ban=:ban  → 商工 GCIS API
  if (url.pathname === "/api/gcis") {
    const ban = url.searchParams.get("ban");
    if (!ban) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少 ban 參數" }));
      return;
    }
    const params = new URLSearchParams({
      $format: "json",
      $filter: `No eq ${ban}`,
      $skip: "0",
      $top: "50",
    });
    proxyFetch(`${GCIS_BASE}?${params}`, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n統一編號驗證工具`);
  console.log(`${"=".repeat(40)}`);
  console.log(`伺服器啟動：http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止\n`);
});
