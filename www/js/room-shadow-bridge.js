/* #223/#236：WebView Storage → Room 的迁移与记录仓库桥。
   v4.1.3 起 Room 是原生环境记录权威；旧 Storage 只作为升级/降级兼容镜像，
   浏览器和旧桥不可用时仍回退原有链路。 */
(function installRoomShadowBridge(global) {
  const PAGE_SIZE = 50;
  let migrationPromise = null;
  let migrationReady = false;
  let baseline = new Map();
  let pendingRecords = null;
  let authorityReady = false;
  let writeQueue = Promise.resolve();

  const plugin = () => global.GuanjiNative?.roomShadow;
  const isNative = () => !!(global.Capacitor && typeof global.Capacitor.isNativePlatform === 'function' && global.Capacitor.isNativePlatform());
  const encryptedState = () => {
    try { return localStorage.getItem('guanji_sec_mode') === 'encrypted' ? 'encrypted' : 'plain'; } catch { return 'unknown'; }
  };
  const revisionOf = () => {
    try { return typeof global.buildStatsSnapshot === 'function' ? Number(global.buildStatsSnapshot().revision) || 0 : 0; } catch { return 0; }
  };
  const cloneRecord = (record) => {
    try { return JSON.parse(JSON.stringify(record)); } catch { return null; }
  };
  const fingerprint = (record) => {
    try { return JSON.stringify(record); } catch { return ''; }
  };
  const sortedRecords = (list) => (Array.isArray(list) ? list : [])
    .map(cloneRecord)
    .filter((record) => record && record.id)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const parsedRecords = (value) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return sortedRecords(parsed);
    } catch { return []; }
  };
  const setBaseline = (list) => {
    baseline = new Map(sortedRecords(list).map((record) => [String(record.id), fingerprint(record)]));
  };
  const key = async () => {
    try { return typeof global.__guanjiGetDEKForRoomShadow === 'function' ? await global.__guanjiGetDEKForRoomShadow() : null; } catch { return null; }
  };
  const call = async (method, options = {}) => {
    const target = plugin();
    if (!isNative() || !target || typeof target[method] !== 'function') return { ok: false, reason: 'unavailable' };
    const dekB64 = await key();
    if (!dekB64) return { ok: false, reason: 'dek_unavailable' };
    try { return await target[method]({ ...options, dekB64 }); } catch (error) {
      return { ok: false, reason: 'bridge_error', message: String(error?.message || error || '') };
    }
  };

  async function inspect() { return call('inspect'); }

  /* #236：Room 权威加载。首次升级或中断迁移时用旧 Storage 作为一次性种子，
     之后所有原生读取均来自 Room；旧 Storage 只在 Room 成功提交后更新为兼容镜像。 */
  async function loadAuthoritative(fallback = []) {
    const resolveFallback = async () => {
      try {
        const value = typeof fallback === 'function' ? await fallback() : fallback;
        return sortedRecords(value);
      } catch { return []; }
    };
    if (!plugin() || !isNative()) {
      const fallbackList = await resolveFallback();
      return { ok: false, reason: 'unavailable', records: fallbackList };
    }
    const result = await call('loadRecords');
    if (!result.ok) return { ...result, records: await resolveFallback() };
    let loaded = parsedRecords(result.records);
    let initialized = false;
    if (result.state !== 'COMPLETED') {
      const fallbackList = await resolveFallback();
      const seeded = await call('replaceRecords', {
        records: fallbackList,
        sourceRevision: revisionOf(),
        encryptedState: encryptedState(),
      });
      if (!seeded.ok) return { ...seeded, records: fallbackList };
      loaded = fallbackList;
      initialized = true;
    }
    setBaseline(loaded);
    migrationReady = true;
    authorityReady = true;
    return { ...result, records: loaded, authoritative: true, initialized };
  }

  async function ensureReady(fallback = []) {
    if (authorityReady) return { ok: true, authoritative: true, skipped: true };
    return loadAuthoritative(fallback);
  }

  async function migrate(records) {
    const list = sortedRecords(records);
    if (!plugin() || !isNative()) return { ok: false, reason: 'unavailable' };
    if (migrationPromise) return migrationPromise;
    migrationPromise = (async () => {
      const existing = await inspect();
      if (!existing.ok) return existing;
      const revision = revisionOf();
      const reset = Number(existing.recordCount || 0) > 0 && Number(existing.sourceRevision || 0) !== revision;
      let cursor = reset ? null : (existing.lastRecordId || null);
      let start = cursor ? list.findIndex((record) => String(record.id) > String(cursor)) : 0;
      if (start < 0) start = 0;
      if (!reset && existing.state === 'COMPLETED' && Number(existing.recordCount) === list.length && Number(existing.sourceRevision || 0) === revision) {
        setBaseline(list);
        migrationReady = true;
        return { ...existing, skipped: true };
      }
      let lastResult = existing;
      if (list.length === 0) {
        lastResult = await call('migrateRecordBatch', { records: [], sourceRevision: revision, cursor: null, reset: true, hasMore: false, encryptedState: encryptedState() });
      } else {
        while (start < list.length) {
          const page = list.slice(start, start + PAGE_SIZE);
          const hasMore = start + page.length < list.length;
          lastResult = await call('migrateRecordBatch', {
            records: page,
            sourceRevision: revision,
            cursor: start > 0 ? String(list[start - 1].id) : null,
            reset: reset && start === 0,
            hasMore,
            encryptedState: encryptedState(),
          });
          if (!lastResult.ok) return lastResult;
          start += page.length;
        }
      }
      setBaseline(list);
      migrationReady = !!lastResult.ok;
      if (pendingRecords) {
        const next = pendingRecords;
        pendingRecords = null;
        await observe(next);
      }
      return lastResult;
    })().finally(() => { migrationPromise = null; });
    return migrationPromise;
  }

  async function observe(records) {
    const list = sortedRecords(records);
    if (!plugin() || !isNative()) return { ok: false, reason: 'unavailable' };
    if (!migrationReady) {
      pendingRecords = list;
      return { ok: false, reason: 'migration_pending' };
    }
    const current = new Map(list.map((record) => [String(record.id), record]));
    const upserts = [];
    current.forEach((record, id) => {
      const nextFingerprint = fingerprint(record);
      if (baseline.get(id) !== nextFingerprint) upserts.push(record);
    });
    const deletes = [];
    baseline.forEach((_, id) => { if (!current.has(id)) deletes.push(id); });
    if (!upserts.length && !deletes.length) return { ok: true, upserted: 0, deleted: 0, skipped: true };
    const result = await call('applyDelta', {
      upserts,
      deletes,
      sourceRevision: revisionOf(),
      encryptedState: encryptedState(),
    });
    if (result.ok) setBaseline(list);
    return result;
  }

  /* #236：统一新增/编辑/删除提交。按 baseline 计算增量并在 Room 事务完成后
     更新兼容镜像；队列保证快速连续点击不会交叉覆盖。 */
  function commitRecords(records) {
    const list = sortedRecords(records);
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      if (!authorityReady) {
        const ready = await loadAuthoritative(list);
        if (!ready.ok) return ready;
      }
      const current = new Map(list.map((record) => [String(record.id), record]));
      const upserts = [];
      current.forEach((record, id) => {
        if (baseline.get(id) !== fingerprint(record)) upserts.push(record);
      });
      const deletes = [];
      baseline.forEach((_, id) => { if (!current.has(id)) deletes.push(id); });
      const result = upserts.length || deletes.length
        ? await call('applyDelta', {
          upserts,
          deletes,
          sourceRevision: revisionOf(),
          encryptedState: encryptedState(),
        })
        : { ok: true, upserted: 0, deleted: 0, skipped: true };
      if (!result.ok) return result;
      setBaseline(list);
      if (typeof global.secureSaveRecords === 'function') {
        try { await global.secureSaveRecords(list); } catch (error) { console.error('[room] legacy mirror failed', error); }
      }
      return { ...result, authoritative: true, recordCount: list.length };
    });
    return writeQueue;
  }

  /* #236：覆盖恢复、演示数据和清空共用同一 Room 原子替换入口。 */
  function replaceRecords(records) {
    const list = sortedRecords(records);
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const result = await call('replaceRecords', {
        records: list,
        sourceRevision: revisionOf(),
        encryptedState: encryptedState(),
      });
      if (!result.ok) return result;
      setBaseline(list);
      migrationReady = true;
      authorityReady = true;
      if (typeof global.secureSaveRecords === 'function') {
        try { await global.secureSaveRecords(list); } catch (error) { console.error('[room] legacy mirror failed', error); }
      }
      return { ...result, authoritative: true };
    });
    return writeQueue;
  }

  global.GuanjiRoomShadow = Object.freeze({
    inspect,
    migrate,
    observeRecords: observe,
    loadAuthoritative,
    ensureReady,
    commitRecords,
    replaceRecords,
    debugState: () => ({ migrationReady, authorityReady, pending: !!pendingRecords, baselineSize: baseline.size }),
  });
})(window);
