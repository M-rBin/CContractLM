/**
 * SqlGuard 安全校验验证脚本
 *
 * 项目未引入 jest，此处用 ts-node 独立运行的断言脚本覆盖注入与越权用例。
 * 运行：npx ts-node scripts/verify-sql-guard.ts
 * 全部通过退出码 0，任一失败退出码 1。
 */
import { guardSql, MAX_ROW_LIMIT } from '../src/modules/ai/agent/sql-guard';

interface Case {
  name: string;
  sql: string;
  expectOk: boolean;
  /** 期望 safeSql 满足的断言（可选） */
  assertSafe?: (safeSql: string) => boolean;
}

const cases: Case[] = [
  // 合法用例
  {
    name: '简单 SELECT 自动注入 LIMIT',
    sql: 'SELECT id, name FROM contract_info WHERE status = "履行中"',
    expectOk: true,
    assertSafe: (s) => /limit\s+1000$/i.test(s),
  },
  {
    name: 'JOIN 白名单表',
    sql: 'SELECT a.name FROM contract_info a JOIN contract_payment_plan b ON a.id = b.contractId',
    expectOk: true,
  },
  {
    name: '已有合法 LIMIT 保留',
    sql: 'SELECT * FROM contract_reminder LIMIT 50',
    expectOk: true,
    assertSafe: (s) => /limit\s+50$/i.test(s),
  },
  {
    name: '超大 LIMIT 收紧到 1000',
    sql: 'SELECT * FROM contract_milestone LIMIT 99999',
    expectOk: true,
    assertSafe: (s) => new RegExp(`limit\\s+${MAX_ROW_LIMIT}$`, 'i').test(s),
  },
  {
    name: 'WITH CTE 拒绝（避免临时表别名绕过白名单）',
    sql: 'WITH t AS (SELECT id FROM contract_info) SELECT * FROM t',
    expectOk: false,
  },

  // 拦截用例
  { name: '空 SQL', sql: '', expectOk: false },
  { name: '多语句注入', sql: 'SELECT * FROM contract_info; DROP TABLE contract_info', expectOk: false },
  { name: 'UPDATE 写操作', sql: 'UPDATE contract_info SET amount = 0', expectOk: false },
  { name: 'DELETE 写操作', sql: 'DELETE FROM contract_info WHERE id = 1', expectOk: false },
  { name: 'INSERT 写操作', sql: 'INSERT INTO contract_info (name) VALUES ("x")', expectOk: false },
  { name: 'DROP DDL', sql: 'DROP TABLE contract_info', expectOk: false },
  { name: '越权系统表', sql: 'SELECT * FROM base_sys_user', expectOk: false },
  { name: 'information_schema 探测', sql: 'SELECT * FROM information_schema.tables', expectOk: false },
  { name: 'SLEEP 时间盲注', sql: 'SELECT * FROM contract_info WHERE id = 1 OR SLEEP(5)', expectOk: false },
  { name: 'OUTFILE 写文件', sql: 'SELECT * FROM contract_info INTO OUTFILE "/tmp/x"', expectOk: false },
  { name: '注释注入绕过', sql: 'SELECT * FROM contract_info -- ; DROP TABLE contract_info', expectOk: true },
  { name: '块注释藏写操作', sql: 'SELECT * FROM contract_info /* */ ; DELETE FROM contract_info', expectOk: false },
  { name: '非白名单表 JOIN', sql: 'SELECT * FROM contract_info JOIN base_sys_role r ON 1=1', expectOk: false },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const result = guardSql(c.sql);
  let ok = result.ok === c.expectOk;
  if (ok && c.expectOk && c.assertSafe) {
    ok = !!result.safeSql && c.assertSafe(result.safeSql);
  }
  if (ok) {
    passed++;
    process.stdout.write(`✓ ${c.name}\n`);
  } else {
    failed++;
    process.stderr.write(
      `✗ ${c.name} | 期望 ok=${c.expectOk} 实际 ok=${result.ok} reason=${result.reason || '-'} safeSql=${result.safeSql || '-'}\n`,
    );
  }
}

process.stdout.write(`\n通过 ${passed} / ${cases.length}，失败 ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
