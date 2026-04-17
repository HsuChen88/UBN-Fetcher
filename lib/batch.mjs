/**
 * 批次處理，加入 concurrency 控制避免打爆 API
 *
 * @param {string[]} items       - 要處理的項目清單
 * @param {Function} queryFn     - 單一項目的非同步查詢函式 (item) => Promise<result>
 * @param {Object}   options
 * @param {number}   options.concurrency - 同時並發數（預設 5）
 * @param {number}   options.delayMs    - 每批之間等待毫秒數（預設 200）
 */
export async function processBatch(items, queryFn, { concurrency = 5, delayMs = 200 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(queryFn));
    results.push(...chunkResults);
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}
