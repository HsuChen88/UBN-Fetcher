# 台灣 UBN（統一編號）驗證 API 文件整理

> 調查日期：2026-04-12  
> 目標：找出可驗證統一編號是否真實存在（有登記）的公開 API

---

## 一、財政部財政資訊中心政府資料開放 openAPI

- **Swagger UI**：https://eip.fia.gov.tw/OAI/swagger-ui.html#/
- **API Spec（JSON）**：https://eip.fia.gov.tw/OAI/v2/api-docs
- **Host**：eip.fia.gov.tw
- **Base Path**：`/OAI`
- **Swagger Version**：2.0

### 相關 API Endpoints

#### ★ 全國營業(稅籍)登記資料 — Dataset 9400

> **最適合 UBN 驗證使用**：直接以 BAN（統一編號）查詢，返回該稅籍登記資料。若查無結果代表未登記。

| 說明 | Method | Endpoint | 參數 |
|------|--------|----------|------|
| 列表查詢 | GET | `/api/businessRegistration` | `limit` (int), `offset` (int) |
| **依 BAN 查詢** | GET | `/api/businessRegistration/{ban}` | `ban`：8 碼統一編號（path） |

**回應欄位**（JSON 物件）：

| 欄位 | 說明 |
|------|------|
| `ban` | 統一編號 |
| `businessNm` | 營業人名稱 |
| `businessAddress` | 營業地址 |
| `headquartersBan` | 總機構統一編號 |
| `capitalAmount` | 資本額 |
| `businessSetupDate` | 設立日期 |
| `businessType` | 組織型態 |
| `isUseInvoice` | 是否使用發票 |
| `industryCd` | 行業代碼 |
| `industryNm` | 行業名稱 |

**驗證邏輯**：
- HTTP 200 + 有資料 → UBN 存在（稅籍登記中）
- HTTP 404 或空陣列 → UBN 未登記

---

#### 非營利事業機關團體資料 — Dataset 34147

| 說明 | Method | Endpoint | 參數 |
|------|--------|----------|------|
| 列表查詢 | GET | `/api/nonBusinessUnit` | `limit`, `offset` |
| 搜尋 | GET | `/api/nonBusinessUnit/search` | `ban` (選填), `hsnNm` (選填), `limit`, `offset` |
| **依 BAN 查詢** | GET | `/api/nonBusinessUnit/{ban}` | `ban`：統一編號（path） |

**回應欄位**：ban, unitNm, hsnNm, modifyDate, modifyCd, modifyReason

---

#### 全國各級學校統一編號資料 — Dataset 75136

| 說明 | Method | Endpoint | 參數 |
|------|--------|----------|------|
| 列表查詢 | GET | `/api/schoolBanData` | `limit`, `offset` |
| 搜尋 | GET | `/api/schoolBanData/search` | `hsnNm` (選填), `limit`, `offset` |
| **依 BAN 查詢** | GET | `/api/schoolBanData/{ban}` | `ban`：統一編號（path） |

**回應欄位**：ban, unitNm, hsnNm, modifyDate, modifyReasonCd, modifyReasonNm

---

### 通用回應狀態碼

| Code | 說明 |
|------|------|
| 200 | 查詢成功 |
| 401 | 未授權 |
| 403 | 禁止存取 |
| 404 | 未找到 |
| 500 | 查詢異常 |

---

## 二、中華民國經濟部商工行政資料開放平台

- **規則說明頁**：https://data.gcis.nat.gov.tw/od/rule
- **共 60 個 API endpoints**
- **回應格式**：JSON 或 XML（透過 `$format` 參數切換）
- **⚠️ 注意**：需申請加入白名單，請將外部 IP 寄至 `opendata.gcis@gmail.com`

### 通用查詢參數

| 參數 | 說明 | 預設 | 最大值 |
|------|------|------|--------|
| `$format` | 回應格式：`json` 或 `xml` | — | — |
| `$filter` | 過濾條件 | — | — |
| `$skip` | 分頁起始筆數 | 0 | 500,000 |
| `$top` | 每次回傳筆數 | 50 | 1,000 |

---

### 相關 API Endpoints

#### ★ API #49：統編查是否為公司、分公司及商業

> **最適合 UBN 驗證使用**：輸入任意統一編號，判斷其是否為公司、分公司或商業（獨資/合夥）。

- **Endpoint**：`https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D`
- **Method**：GET
- **必填參數**：
  - `$format`：`json` 或 `xml`
  - `No`：統一編號（8 碼）

**驗證邏輯**：
- 有回傳結果 → UBN 存在（公司、分公司或商業登記）
- 空陣列 → UBN 未登記

---

#### ★ API #48：統編查公司名稱

- **Endpoint**：`https://data.gcis.nat.gov.tw/od/data/api/9D17AE0D-09B5-4732-A8F4-81ADED04B679`
- **Method**：GET
- **必填參數**：
  - `$format`：`json` 或 `xml`
  - `Business_Accounting_NO`：統一編號（8 碼）
- **選填參數**：`$skip`, `$top`

**驗證邏輯**：
- 有回傳公司名稱 → UBN 為已登記公司
- 空陣列 → 非公司型態或未登記

---

#### ★ API #11：統編查商號名稱（商業登記）

- **Endpoint**：`https://data.gcis.nat.gov.tw/od/data/api/855A3C87-003A-4930-AA4B-2F4130D713DC`
- **Method**：GET
- **必填參數**：
  - `$format`：`json` 或 `xml`
  - `President_No`：統一編號（8 碼）
- **選填參數**：`$skip`, `$top`

**說明**：針對商業登記（獨資、合夥）的統一編號查詢

---

## 三、實際測試結果

> 測試時間：2026-04-12

### 財政部 API 測試

| UBN | HTTP Status | 結果 | 公司名稱 |
|-----|-------------|------|----------|
| 22099131 | 200 | ✓ 存在 | 台灣積體電路製造股份有限公司 |
| 96979933 | 200 | ✓ 存在 | 中華電信股份有限公司 |
| 03077208 | 200 | ✓ 存在 | 中國信託商業銀行股份有限公司 |
| 12345678 | 404 | ✗ 未登記 | — |
| 87654321 | 404 | ✗ 未登記 | — |
| 00000000 | 404 | ✗ 未找到（但商工有登記） | — |

### 商工 API #49 測試

回應格式：`[{"Year":"115","exist":"Y/N","TYPE":"公司/分公司/商業"}, ...]`

| UBN | exist:Y 的型態 | 結果 |
|-----|---------------|------|
| 22099131 | 公司 | ✓ 存在 |
| 96979933 | 公司 | ✓ 存在 |
| 03077208 | 公司 | ✓ 存在 |
| 12345678 | 無 | ✗ 未登記 |
| 87654321 | 無 | ✗ 未登記 |
| 00000000 | 商業 | ✓ 存在（商業登記）|

### 重要發現

1. **兩個 API 覆蓋範圍不同**：`00000000` 在財政部 API 查無，但在商工 API 有商業登記，說明財政部只涵蓋稅籍登記，商工涵蓋商業登記（獨資/合夥）。
2. **商工 API #11 需要 IP 白名單**，但 API #49 目前無此限制。
3. **兩者並用可達到最完整覆蓋**。

---

## 四、驗證策略建議

對一批 8 碼整數進行 UBN 存在驗證，建議策略：

### 方案 A：財政部稅籍 API（無需申請，覆蓋最廣）

```
GET https://eip.fia.gov.tw/OAI/api/businessRegistration/{ban}
```

- 優點：免申請白名單、涵蓋所有有稅籍的營業人
- 缺點：學校、非營利可能需另查

### 方案 B：商工 API #49（需白名單，判斷最完整）

```
GET https://data.gcis.nat.gov.tw/od/data/api/673F0FC0-B3A7-429F-9041-E9866836B66D?$format=json&No={ban}
```

- 優點：一次判斷公司/分公司/商業三種型態
- 缺點：需申請白名單才能從外部 IP 存取

### 方案 C（完整）：兩者並用

1. 先查財政部稅籍 API → 確認有無稅籍
2. 若需知道登記型態，再查商工 API #49
