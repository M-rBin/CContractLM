export type PendingStatus = '待处理' | '已完成' | '逾期';

export function resolvePendingStatus(status: string, planDate: string | Date, today = new Date()): PendingStatus {
  if (status === '已完成') return '已完成';
  if (status === '逾期') return '逾期';

  const plan = toStartOfDay(planDate);
  const current = toStartOfDay(today);
  return plan < current ? '逾期' : '待处理';
}

function toStartOfDay(value: string | Date): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
