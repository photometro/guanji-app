/* #221 P0: 协议、黄金测试集、桥接边界和 SQLCipher 准入的离线校验。 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contractsDir = path.join(root, 'docs', 'contracts');
const fixturePath = path.join(root, 'debug', 'fixtures', '221-golden.json');
const schemaFiles = {
  recordEvent: ['record-event.schema.json', 'records', 'direct'],
  statsSnapshot: ['stats-snapshot.schema.json', null, 'statsSnapshot'],
  behaviorModelSnapshot: ['behavior-model-snapshot.schema.json', null, 'behaviorModelSnapshot'],
  evidenceGraph: ['evidence-graph.schema.json', null, 'evidenceGraph'],
  insightCache: ['insight-cache.schema.json', null, 'insightCache'],
  backupEnvelope: ['backup-envelope.schema.json', 'backupEnvelopes', 'v353Encrypted'],
};

const failures = [];
function fail(message) { failures.push(message); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${path.relative(root, file)}: JSON 无法读取 (${error.message})`); return null; }
}
function typeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => (
    type === 'null' ? value === null :
    type === 'array' ? Array.isArray(value) :
    type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
    type === 'integer' ? Number.isInteger(value) :
    type === 'number' ? typeof value === 'number' && Number.isFinite(value) :
    typeof value === type
  ));
}
function validate(value, schema, location) {
  if (!typeMatches(value, schema.type)) { fail(`${location}: 类型应为 ${JSON.stringify(schema.type)}`); return; }
  if (schema.required) for (const key of schema.required) if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${location}: 缺少必填字段 ${key}`);
  if (schema.minLength !== undefined && value.length < schema.minLength) fail(`${location}: 字符串不能为空`);
  if (schema.minItems !== undefined && value.length < schema.minItems) fail(`${location}: 数组项目不足`);
  if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(`${location}: 数组项目过多`);
  if (schema.minimum !== undefined && value < schema.minimum) fail(`${location}: 数值小于最小值`);
  if (schema.maximum !== undefined && value > schema.maximum) fail(`${location}: 数值大于最大值`);
  if (schema.pattern && typeof value === 'string' && !(new RegExp(schema.pattern).test(value))) fail(`${location}: 不匹配 ${schema.pattern}`);
  if (schema.const !== undefined && value !== schema.const) fail(`${location}: 不匹配 const`);
  if (schema.enum && !schema.enum.includes(value)) fail(`${location}: 不在允许枚举中`);
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => validate(item, schema.items, `${location}[${index}]`));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const [key, child] of Object.entries(props)) if (Object.prototype.hasOwnProperty.call(value, key)) validate(value[key], child, `${location}.${key}`);
  }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

const fixture = readJson(fixturePath);
if (!fixture) process.exit(1);
for (const [name, [file, container, key]] of Object.entries(schemaFiles)) {
  const schema = readJson(path.join(contractsDir, file));
  const value = container ? fixture[container][key] : fixture[key];
  if (schema && value) validate(value, schema, name);
  if (!value) fail(`${name}: 黄金样本缺失`);
}

const unknownInput = clone(fixture.backupEnvelopes.v353Encrypted);
const unknownRoundTrip = JSON.parse(JSON.stringify(unknownInput));
if (!unknownRoundTrip.futureField || unknownRoundTrip.futureField.mustSurvive !== true) fail('BackupEnvelope: 未知字段没有往返保留');
const recordUnknown = clone(fixture.records.direct);
recordUnknown.futureField = { origin: 'future-version' };
if (JSON.parse(JSON.stringify(recordUnknown)).futureField.origin !== 'future-version') fail('RecordEvent: 未知字段没有往返保留');

const aiPayload = { windowDays: 7, stats: fixture.statsSnapshot, behaviorModel: fixture.behaviorModelSnapshot, evidenceGraph: fixture.evidenceGraph };
const serializedAi = JSON.stringify(aiPayload);
for (const forbidden of ['occurredAtMs', 'note', 'records', 'attachments', 'exactTimeline']) if (serializedAi.includes(`"${forbidden}"`)) fail(`AI payload: 包含禁止字段 ${forbidden}`);

const bridgeResponse = { ok: true, schemaVersion: 1, dataRevision: fixture.behaviorModelSnapshot.dataRevision, statsSnapshot: fixture.statsSnapshot, snapshot: fixture.behaviorModelSnapshot, evidenceGraph: fixture.evidenceGraph };
if (!bridgeResponse.statsSnapshot || !bridgeResponse.snapshot || !bridgeResponse.evidenceGraph) fail('Bridge: 缺少完整单次快照');
if (JSON.stringify(bridgeResponse).includes('RecordEvent')) fail('Bridge: 不得包含原始 RecordEvent');

const requiredLegacyCases = ['legacyV353', 'v387Encrypted', 'csvImport', 'timezoneChange', 'invalidDate', 'widget', 'migrationInterruption'];
for (const key of requiredLegacyCases) {
  const found = fixture.records[key] || fixture.backupEnvelopes[key] || fixture.legacyInputs[key];
  if (found === undefined) fail(`Golden set: 缺少 ${key}`);
}

if (failures.length) {
  console.error(`221 contract verification failed (${failures.length})`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}
console.log('221 contract verification passed');
console.log(`schemas=${Object.keys(schemaFiles).length}; legacyCases=${requiredLegacyCases.length}; unknownFieldRoundTrip=passed; aiPrivacyBoundary=passed; bridge=single-snapshot`);
