/**
 * Text-to-SQL 表结构提示词
 *
 * 只暴露白名单表的业务字段（排除 tenantId 等内部字段），供大模型生成 SQL。
 * 与 SqlGuard 的表/列白名单保持一致。
 */
export const SCHEMA_PROMPT = `你可以查询以下 MySQL 表（只读，只能用 SELECT）：

-- 合同主表
contract_info(
  id INT 主键,
  code VARCHAR 合同编号,
  name VARCHAR 合同名称,
  type VARCHAR 合同类型(采购合同/销售合同/服务合同/租赁合同/框架协议/其他合同),
  signSubject VARCHAR 签约主体,
  counterparty VARCHAR 相对方,
  amount DECIMAL 合同金额,
  currency VARCHAR 币种,
  signDate DATETIME 签订日期,
  effectiveDate DATETIME 生效日期,
  expireDate DATETIME 到期日期,
  ownerName VARCHAR 负责人,
  status VARCHAR 合同状态(草稿/履行中/已到期/已终止/已归档),
  createTime DATETIME 创建时间
)

-- 收付款计划表
contract_payment_plan(
  id INT 主键,
  contractId INT 关联 contract_info.id,
  direction VARCHAR 方向(收款/付款),
  planAmount DECIMAL 计划金额,
  planDate DATETIME 计划日期,
  actualAmount DECIMAL 实际金额,
  actualDate DATETIME 实际日期,
  paidAmount DECIMAL 已收付金额,
  status VARCHAR 状态(待处理/已完成/逾期)
)

-- 履约节点表
contract_milestone(
  id INT 主键,
  contractId INT 关联 contract_info.id,
  name VARCHAR 节点名称,
  planDate DATETIME 计划日期,
  actualDate DATETIME 实际完成日期,
  ownerName VARCHAR 负责人,
  status VARCHAR 状态(待处理/已完成/逾期)
)

-- 履约提醒表
contract_reminder(
  id INT 主键,
  contractId INT 关联 contract_info.id,
  type VARCHAR 提醒类型,
  content VARCHAR 提醒内容,
  planDate DATETIME 计划日期,
  overdueStatus VARCHAR 逾期状态(未逾期/已逾期),
  handleStatus VARCHAR 处理状态(待处理/已完成)
)

生成 SQL 的规则：
- 只能生成一条 SELECT 语句，不得包含任何写操作或多语句。
- 只能查询以上四张表，不得查询其他表或系统表。
- 需要关联时用 contractId 关联 contract_info.id。
- 日期比较用 MySQL 函数（如 CURDATE()、DATE_ADD）。
- 只输出 SQL 本身，不要输出解释、注释或 markdown 代码块标记。`;
