import { strict as assert } from 'assert';
import { buildContractDemoSeed } from '../src/common/contract-demo-seed';

const rows = buildContractDemoSeed(new Date('2026-07-15T00:00:00.000Z'));

assert.equal(rows.length, 24);
assert.equal(new Set(rows.map((item) => item.code)).size, rows.length);

const types = new Set(rows.map((item) => item.type));
for (const type of ['采购合同', '销售合同', '服务合同', '租赁合同', '框架协议', '其他合同']) {
  assert.ok(types.has(type), `missing contract type: ${type}`);
}

const statuses = new Set(rows.map((item) => item.status));
for (const status of ['草稿', '履行中', '已到期', '已终止', '已归档']) {
  assert.ok(statuses.has(status), `missing contract status: ${status}`);
}

assert.ok(rows.some((item) => item.attachments.length > 0), 'missing attachments');
assert.ok(rows.every((item) => item.milestones.length >= 1), 'missing milestones');
assert.ok(rows.every((item) => item.payments.length >= 1), 'missing payments');
assert.ok(rows.some((item) => item.expireDate < new Date('2026-07-15T00:00:00.000Z')), 'missing overdue contract');
assert.ok(rows.some((item) => item.expireDate > new Date('2026-07-15T00:00:00.000Z')), 'missing future contract');

process.stdout.write('contract-demo-seed.spec passed\n');
