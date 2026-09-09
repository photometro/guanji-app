/* #226/#227/#228/#229：EvidenceGraph 的 WebView 适配、持续性/候选变化期/共同变化
   关系投影与 AI 引用校验。
   只消费聚合 StatsSnapshot/BehaviorModelSnapshot；不读取或序列化原始记录。 */
(function installEvidenceGraph(global) {
  const SCHEMA_VERSION = 1;
  const MODEL_VERSION = '4.1.3-room-authority';
  const ALLOWED_CLAIM_TYPES = new Set([
    'single_evidence_explanation', 'cross_dimension_summary', 'change_ranking',
    'stable_item_contrast', 'temporal_comparison',
    'pattern_hypothesis', 'alternative_explanation', 'counter_evidence',
    'uncertainty_explanation', 'observation_suggestion', 'historical_comparison',
  ]);
  /* #230：只有这些 claim 类型能证明 AI 带来了本地事实之外的观察价值。 */
  const VALUE_ADDED_CLAIM_TYPES = new Set([
    'cross_dimension_summary', 'change_ranking', 'stable_item_contrast',
    'temporal_comparison', 'pattern_hypothesis',
    'alternative_explanation', 'counter_evidence', 'uncertainty_explanation',
    'observation_suggestion', 'historical_comparison',
  ]);

  function safeMetric(metric) {
    return String(metric || 'metric').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'metric';
  }

  function graphRevision(statsSnapshot, behaviorModel) {
    const value = behaviorModel?.dataRevision ?? statsSnapshot?.revision ?? 0;
    const revision = Number(value);
    return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
  }

  function evidenceNode({ evidenceId, dimension, metric, state, magnitude, persistence, confidence, status, revision, modelVersion, limitation, changePoint, relationEvidence }) {
    const node = {
      evidenceId, dimension, metric, state, magnitude, persistence, confidence, status,
      dataRevision: revision,
      modelVersion,
      limitations: [limitation],
    };
    if (changePoint && typeof changePoint === 'object') node.changePoint = changePoint;
    if (relationEvidence && typeof relationEvidence === 'object') node.relationEvidence = relationEvidence;
    return node;
  }

  function buildEvidenceGraph(statsSnapshot = null, behaviorModel = null) {
    const stats = statsSnapshot && typeof statsSnapshot === 'object' ? statsSnapshot : {};
    const model = behaviorModel && typeof behaviorModel === 'object' ? behaviorModel : {};
    const revision = graphRevision(stats, model);
    const modelVersion = String(model.modelVersion || MODEL_VERSION);
    const statsId = `ev-stats-${revision}`;
    const nodes = [evidenceNode({
      evidenceId: statsId,
      dimension: 'stats',
      metric: 'aggregateSnapshot',
      state: 'available',
      magnitude: 'none',
      persistence: 'not_evaluated',
      confidence: stats.freshness === 'fresh' ? 'high' : 'low',
      status: stats.freshness === 'stale' ? 'stale' : 'available',
      revision,
      modelVersion,
      limitation: '统计快照只描述当前聚合数据，不代表因果关系',
    })];
    const metrics = model.baseline?.metrics && typeof model.baseline.metrics === 'object'
      ? model.baseline.metrics
      : {};
    const deviations = Array.isArray(model.deviations) ? model.deviations : [];
    const persistenceByMetric = new Map(
      (Array.isArray(model.persistence) ? model.persistence : [])
        .filter((item) => item && item.metric)
        .map((item) => [String(item.metric), item]),
    );
    const entries = Object.entries(metrics);
    if (!entries.length) deviations.forEach((item) => entries.push([item?.metric || 'metric', item]));
    const relations = [];
    entries.forEach(([key, raw]) => {
      const metric = raw && typeof raw === 'object' ? raw : {};
      const metricName = String(metric.metric || key);
      const available = metric.available === true;
      const persistence = persistenceByMetric.get(metricName);
      const evidenceId = `ev-${safeMetric(metricName)}-${revision}`;
      nodes.push(evidenceNode({
        evidenceId,
        dimension: metricName === 'recordDensity' ? 'rhythm' : metricName === 'duration' ? 'duration' : 'behavior',
        metric: metricName,
        state: available ? String(metric.direction || 'stable') : 'insufficient',
        magnitude: available ? String(metric.magnitude || 'none') : 'unknown',
        persistence: available ? String(persistence?.state || 'uncertain') : 'uncertain',
        confidence: available && model.baseline?.status === 'ready' ? 'high' : 'low',
        status: available ? 'available' : 'insufficient',
        revision,
        modelVersion,
        limitation: available ? '变化仅表示相对个人基线的偏离，不是健康或正常值判断' : '历史跨度或样本不足，暂不判断变化方向',
        changePoint: persistence?.changePoint,
      }));
      relations.push({ from: evidenceId, to: statsId, relation: 'derived_from' });
    });
    const modelRelations = Array.isArray(model.relations) ? model.relations : [];
    modelRelations.slice(0, 12).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const type = String(item.type || 'relation');
      const from = String(item.from || 'from');
      const to = String(item.to || 'to');
      const relation = String(item.relation || 'insufficient_relation');
      const relationId = `ev-relation-${safeRelationPart(type)}-${safeRelationPart(from)}-${safeRelationPart(to)}-${revision}`;
      const limitation = Array.isArray(item.limitations) && item.limitations[0]
        ? String(item.limitations[0])
        : '关系只描述聚合数据中的共同变化，不代表因果关系';
      nodes.push(evidenceNode({
        evidenceId: relationId,
        dimension: 'relation',
        metric: `${safeRelationPart(from)}-${safeRelationPart(to)}`,
        state: relation,
        magnitude: relation,
        persistence: 'not_evaluated',
        confidence: String(item.confidence || 'low'),
        status: relation === 'insufficient_relation' ? 'insufficient' : 'available',
        revision,
        modelVersion,
        limitation,
        relationEvidence: item,
      }));
      relations.push({ from: relationId, to: statsId, relation: 'derived_from' });
      if (type === 'temporal_co_movement') {
        const fromId = `ev-${safeMetric(from)}-${revision}`;
        const toId = `ev-${safeMetric(to)}-${revision}`;
        relations.push({ from: fromId, to: toId, relation });
      }
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      modelVersion,
      dataRevision: revision,
      generatedAtMs: Number(model.generatedAtMs || stats.generatedAtMs || Date.now()),
      nodes,
      relations,
      limitations: ['证据只来自聚合统计与个人历史基线', '记录缺失不等于没有发生', '不输出健康、正常值或确定性因果结论'],
    };
  }

  function safeRelationPart(value) {
    return String(value || 'value').toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'value';
  }

  function validateEvidenceRefs(claim, graph) {
    if (!claim || typeof claim !== 'object' || !graph || typeof graph !== 'object') return false;
    if (typeof claim.claimId !== 'string' || !claim.claimId || claim.claimId.length > 80) return false;
    if (typeof claim.claimType !== 'string' || !ALLOWED_CLAIM_TYPES.has(claim.claimType)) return false;
    if (typeof claim.text !== 'string' || !claim.text.trim() || claim.text.length > 240) return false;
    if (!Array.isArray(claim.evidenceRefs) || claim.evidenceRefs.length < 1 || claim.evidenceRefs.length > 6) return false;
    const nodes = new Map((Array.isArray(graph.nodes) ? graph.nodes : []).map((node) => [String(node?.evidenceId || ''), node]));
    return claim.evidenceRefs.every((id) => {
      const node = nodes.get(String(id || ''));
      return !!node
        && Number(node.dataRevision) === Number(graph.dataRevision)
        && String(node.modelVersion || '') === String(graph.modelVersion || '');
    });
  }

  function validateEvidenceClaims(claims, graph) {
    return !claims || (Array.isArray(claims) && claims.length <= 6 && claims.every((claim) => validateEvidenceRefs(claim, graph)));
  }

  global.EVIDENCE_GRAPH_MODEL_VERSION = MODEL_VERSION;
  global.EVIDENCE_VALUE_ADDED_CLAIM_TYPES = Object.freeze([...VALUE_ADDED_CLAIM_TYPES]);
  global.buildEvidenceGraph = buildEvidenceGraph;
  global.validateEvidenceRefs = validateEvidenceRefs;
  global.validateEvidenceClaims = validateEvidenceClaims;
})(window);
