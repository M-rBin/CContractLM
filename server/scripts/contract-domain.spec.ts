import { strict as assert } from 'assert';
import { resolvePendingStatus } from '../src/modules/contract/utils/contract-status.util';

const today = new Date('2026-07-12T00:00:00.000Z');

assert.equal(resolvePendingStatus('待处理', '2026-07-11', today), '逾期');
assert.equal(resolvePendingStatus('待处理', '2026-07-12', today), '待处理');
assert.equal(resolvePendingStatus('已完成', '2026-07-01', today), '已完成');
assert.equal(resolvePendingStatus('逾期', '2026-07-01', today), '逾期');

process.stdout.write('contract-domain.spec passed\n');
