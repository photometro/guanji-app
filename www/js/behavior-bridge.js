/* #222/#235：一次性行为快照适配器。
   同一 dataRevision 只保留一个请求；WebView 只渲染返回值，不逐卡重算。
   当前页面默认继续使用既有 JS 统计/AI 链；原生化阶段通过该入口渐进切换。 */
(function installBehaviorSnapshotBridge(global) {
  const pending = new Map();
  let lastSnapshotState = null;
  let lastResponse = null;
  let latestRequestedRevision = -1;
  const listeners = new Set();
  const timezone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch { return 'local'; }
  };
  async function requestBehaviorSnapshot(statsSnapshot = null) {
    const snapshot = statsSnapshot || (typeof global.buildStatsSnapshot === 'function' ? global.buildStatsSnapshot() : null);
    if (!snapshot) return { ok: false, accepted: false, reason: 'stats_unavailable' };
    const revision = Number.isFinite(Number(snapshot.revision)) ? Number(snapshot.revision) : 0;
    const bridge = global.GuanjiNative?.behaviorSnapshot;
    if (!bridge || typeof bridge.request !== 'function') return { ok: false, accepted: false, reason: 'unavailable' };
    if (lastResponse && Number(lastResponse.dataRevision) === revision && lastResponse.ok === true) return lastResponse;
    if (pending.has(revision)) return pending.get(revision);
    latestRequestedRevision = Math.max(latestRequestedRevision, revision);
    const payload = {
      schemaVersion: Number(snapshot.schemaVersion) || 1,
      dataRevision: revision,
      requestedAtMs: Date.now(),
      timezone: snapshot.timezone || timezone(),
      statsSnapshot: JSON.stringify(snapshot),
    };
    /* #225：只传递按天聚合的个人模型输入；原始记录仍留在 WebView 本地。 */
    if (typeof global.buildBehaviorModelInput === 'function') {
      const behaviorInput = global.buildBehaviorModelInput(snapshot);
      if (behaviorInput) payload.behaviorInput = JSON.stringify(behaviorInput);
    }
    const request = Promise.resolve(bridge.request(payload)).then((response) => {
      /* #226：缓存同一 revision 的完整证据上下文，供 AI 引用校验；只缓存聚合快照。 */
      const responseRevision = Number(response?.dataRevision ?? revision);
      if (response && response.ok === true && responseRevision < latestRequestedRevision) {
        return {
          ok: false,
          accepted: false,
          dataRevision: responseRevision,
          error: { code: 'STALE_REVISION', retryable: true, message: 'snapshot is older than requested revision' },
        };
      }
      if (response && response.ok === true && response.evidenceGraph) {
        lastResponse = response;
        lastSnapshotState = Object.freeze({
          dataRevision: responseRevision,
          snapshot: response.snapshot || null,
          statsSnapshot: response.statsSnapshot || response.snapshot?.statsSnapshot || null,
          evidenceGraph: response.evidenceGraph,
        });
        listeners.forEach((listener) => { try { listener(lastSnapshotState); } catch {} });
      }
      return response;
    }).catch((error) => ({
      ok: false, accepted: false, reason: 'bridge_error', message: String(error?.message || error || ''),
    })).finally(() => pending.delete(revision));
    pending.set(revision, request);
    return request;
  }
  global.requestBehaviorSnapshot = requestBehaviorSnapshot;
  global.getLastBehaviorEvidenceGraph = () => lastSnapshotState?.evidenceGraph || null;
  global.getLastBehaviorSnapshot = () => lastSnapshotState?.snapshot || null;
  global.getLastStatsSnapshot = () => lastSnapshotState?.statsSnapshot || null;
  global.getSharedStatsSnapshot = (fallback = null) => lastSnapshotState?.statsSnapshot || fallback;
  /* #235：统一快照总线，消费者可订阅同一次 Kotlin 计算的结果；老消费者未接入时
     仍可用原有 JS 快照作为降级，不会因桥不可用而阻塞页面。 */
  global.GuanjiSnapshotBus = Object.freeze({
    get: () => lastSnapshotState,
    subscribe: (listener) => {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  global.__guanjiBehaviorBridge = Object.freeze({
    pendingCount: () => pending.size,
    lastRevision: () => lastSnapshotState?.dataRevision ?? null,
    latestRequestedRevision: () => latestRequestedRevision,
  });
})(window);
