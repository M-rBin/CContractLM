/**
 * SQL 安全网关
 *
 * 经营数据问答（Text-to-SQL）的应用层防线。对大模型生成的 SQL 逐层校验，
 * 任一层不通过即拦截，只有全部通过才允许交给只读连接执行。
 *
 * 防线层次：
 *  1. 非空、单条语句（拒绝多语句 / 注释注入）
 *  2. 只允许 SELECT 开头（拒绝写操作与 DDL）
 *  3. 危险关键字黑名单（INSERT/UPDATE/DELETE/DROP/... 及危险函数）
 *  4. 表白名单（仅允许受控业务表）
 *  5. 强制注入 LIMIT（上限 1000）
 */

/** 允许查询的表白名单 */
export const ALLOWED_TABLES = [
  'contract_info',
  'contract_payment_plan',
  'contract_milestone',
  'contract_reminder',
] as const;

/** 单次查询结果行数上限 */
export const MAX_ROW_LIMIT = 1000;

/** 危险关键字（大小写不敏感，按单词边界匹配） */
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'MERGE',
  'GRANT',
  'REVOKE',
  'RENAME',
  'CALL',
  'EXECUTE',
  'EXEC',
  'INTO',
  'LOAD_FILE',
  'OUTFILE',
  'DUMPFILE',
  'INFORMATION_SCHEMA',
  'MYSQL',
  'PERFORMANCE_SCHEMA',
  'SYS',
  'SLEEP',
  'BENCHMARK',
];

/** 校验结果 */
export interface SqlGuardResult {
  /** 是否通过 */
  ok: boolean;
  /** 拦截原因（未通过时） */
  reason?: string;
  /** 处理后可执行的安全 SQL（通过时，已注入 LIMIT） */
  safeSql?: string;
}

/**
 * 去除 SQL 中的注释与首尾空白，统一空白字符
 */
function stripComments(sql: string): string {
  return sql
    // 行注释 -- 与 #
    .replace(/--[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ')
    // 块注释 /* */
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 校验并加固一条大模型生成的 SQL。
 *
 * @param rawSql 大模型生成的原始 SQL
 * @returns 校验结果；通过时 safeSql 为注入 LIMIT 后的可执行语句
 */
export function guardSql(rawSql: string): SqlGuardResult {
  if (!rawSql || !rawSql.trim()) {
    return { ok: false, reason: '空 SQL' };
  }

  let sql = stripComments(rawSql);

  // 去掉末尾分号（单条语句允许一个结尾分号）
  if (sql.endsWith(';')) {
    sql = sql.slice(0, -1).trim();
  }

  // 1. 单条语句：去掉结尾分号后不应再出现分号
  if (sql.includes(';')) {
    return { ok: false, reason: '只允许单条查询语句' };
  }

  // 2. 必须以 SELECT 开头（不允许 WITH/CTE，避免临时表别名绕过表白名单）
  if (!/^select\s/i.test(sql)) {
    return { ok: false, reason: '只允许 SELECT 查询语句' };
  }

  // 3. 危险关键字黑名单（按单词边界）
  const upper = sql.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      return { ok: false, reason: `包含禁止的关键字：${kw}` };
    }
  }

  // 4. 表白名单：提取 FROM / JOIN 后的表名，逐一校验
  const referencedTables = extractTables(sql);
  if (referencedTables.length === 0) {
    return { ok: false, reason: '未识别到查询的数据表' };
  }
  for (const table of referencedTables) {
    if (!ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number])) {
      return { ok: false, reason: `查询了不允许的数据表：${table}` };
    }
  }

  // 5. 强制注入 LIMIT
  const safeSql = enforceLimit(sql);

  return { ok: true, safeSql };
}

/**
 * 提取 SQL 中 FROM / JOIN 引用的表名（小写、去反引号）
 */
function extractTables(sql: string): string[] {
  const tables = new Set<string>();
  const re = /\b(?:from|join)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    tables.add(m[1].toLowerCase());
  }
  return [...tables];
}

/**
 * 强制注入或收紧 LIMIT，使结果不超过 MAX_ROW_LIMIT。
 */
function enforceLimit(sql: string): string {
  const limitRe = /\blimit\s+(\d+)(?:\s*,\s*(\d+))?\s*$/i;
  const match = sql.match(limitRe);
  if (match) {
    // 已有 LIMIT：取 count（LIMIT a,b 时 b 为行数；LIMIT n 时 n 为行数）
    const count = match[2] !== undefined ? Number(match[2]) : Number(match[1]);
    if (count > MAX_ROW_LIMIT) {
      return sql.replace(limitRe, `LIMIT ${MAX_ROW_LIMIT}`);
    }
    return sql;
  }
  return `${sql} LIMIT ${MAX_ROW_LIMIT}`;
}
