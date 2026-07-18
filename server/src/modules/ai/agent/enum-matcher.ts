/**
 * 枚举模糊匹配
 *
 * 大模型识别出的合同类型/币种等字段，可能与系统枚举值不完全一致
 * （如"技术服务合同"→"服务合同"、"RMB"→"人民币"）。本模块将识别值
 * 归一化到系统枚举；无法可靠匹配时返回 null，由上层留空交人工确认。
 */

/** 合同类型枚举（与后端 DTO CONTRACT_TYPES 保持一致） */
export const CONTRACT_TYPES = [
  '采购合同',
  '销售合同',
  '服务合同',
  '租赁合同',
  '框架协议',
  '其他合同',
] as const;

/** 币种枚举（与后端 DTO CONTRACT_CURRENCIES 保持一致） */
export const CONTRACT_CURRENCIES = ['人民币', '美元', '欧元', '其他'] as const;

/** 合同类型关键词映射：命中关键词即归类到对应枚举 */
const TYPE_KEYWORDS: Array<{ value: string; keywords: string[] }> = [
  { value: '采购合同', keywords: ['采购', '购买', '进货', 'purchase', 'procurement'] },
  { value: '销售合同', keywords: ['销售', '出售', '买卖', 'sales', 'sale'] },
  { value: '服务合同', keywords: ['服务', '技术', '咨询', '维护', '外包', 'service'] },
  { value: '租赁合同', keywords: ['租赁', '租用', '出租', 'lease', 'rent'] },
  { value: '框架协议', keywords: ['框架', '战略合作', 'framework'] },
];

/** 币种关键词映射 */
const CURRENCY_KEYWORDS: Array<{ value: string; keywords: string[] }> = [
  // 注意：不用裸"元"作关键词，否则"日元/港元"等会被误判为人民币
  { value: '人民币', keywords: ['人民币', 'rmb', 'cny', '¥'] },
  { value: '美元', keywords: ['美元', 'usd', 'dollar', '$'] },
  { value: '欧元', keywords: ['欧元', 'eur', 'euro', '€'] },
];

/**
 * 匹配合同类型
 * @param raw 大模型识别出的类型文本
 * @returns 系统枚举值；无法匹配返回 null
 */
export function matchContractType(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  // 完全等于某枚举值直接返回
  const exact = CONTRACT_TYPES.find((t) => t === raw.trim());
  if (exact) return exact;
  // 关键词命中
  for (const { value, keywords } of TYPE_KEYWORDS) {
    if (keywords.some((k) => text.includes(k.toLowerCase()))) return value;
  }
  // 含"合同"或"协议"但未命中具体类型，归为其他合同
  if (text.includes('合同') || text.includes('协议')) return '其他合同';
  return null;
}

/**
 * 匹配币种
 * @param raw 大模型识别出的币种文本
 * @returns 系统枚举值；无法匹配返回 null
 */
export function matchCurrency(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const exact = CONTRACT_CURRENCIES.find((c) => c === raw.trim());
  if (exact) return exact;
  for (const { value, keywords } of CURRENCY_KEYWORDS) {
    if (keywords.some((k) => text.includes(k.toLowerCase()))) return value;
  }
  return null;
}
