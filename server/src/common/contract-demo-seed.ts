export interface ContractDemoAttachmentSeed {
  category: string;
  fileName: string;
  content: string;
}

export interface ContractDemoMilestoneSeed {
  name: string;
  planDate: Date;
  actualDate?: Date;
  ownerName?: string;
  status: string;
  remark?: string;
  completeRemark?: string;
}

export interface ContractDemoPaymentSeed {
  direction: string;
  planAmount: number;
  planDate: Date;
  actualAmount?: number;
  actualDate?: Date;
  status: string;
  remark?: string;
}

export interface ContractDemoRecordSeed {
  operType: string;
  operTarget?: string;
  operatorName?: string;
  operDesc?: string;
}

export interface ContractDemoSeed {
  code: string;
  name: string;
  type: string;
  signSubject: string;
  counterparty: string;
  amount: number;
  currency: string;
  signDate: Date;
  effectiveDate: Date;
  expireDate: Date;
  ownerUsername?: string;
  ownerName: string;
  status: string;
  remark: string;
  attachments: ContractDemoAttachmentSeed[];
  milestones: ContractDemoMilestoneSeed[];
  payments: ContractDemoPaymentSeed[];
  records: ContractDemoRecordSeed[];
}

const typeCycle = ['采购合同', '销售合同', '服务合同', '租赁合同', '框架协议', '其他合同'];
const statusCycle = ['履行中', '履行中', '已到期', '已终止', '已归档', '草稿'];
const ownerCycle = [
  { username: 'li.hua', name: '李华' },
  { username: 'wang.fang', name: '王芳' },
  { username: 'zhao.lin', name: '赵琳' },
  { username: 'chen.mei', name: '陈梅' },
  { username: 'zhang.wei', name: '张伟' },
  { username: 'admin', name: 'Admin' },
];

const counterparties = [
  '上海云杉科技有限公司',
  '北京星瀚数据服务有限公司',
  '杭州锦程供应链有限公司',
  '深圳澜海智能设备有限公司',
  '成都启明咨询有限公司',
  '广州华信办公租赁有限公司',
  '南京博远软件有限公司',
  '苏州明德制造有限公司',
  '武汉至诚信息技术有限公司',
  '重庆新川能源有限公司',
  '厦门海辰网络有限公司',
  '天津方舟物流有限公司',
];

export function buildContractDemoSeed(now = new Date()): ContractDemoSeed[] {
  const base = startOfUtcDay(now);

  const demos = Array.from({ length: 24 }, (_, index) => {
    const type = typeCycle[index % typeCycle.length];
    const status = statusCycle[index % statusCycle.length];
    const owner = ownerCycle[index % ownerCycle.length];
    const sequence = index + 1;
    const amount = 80000 + sequence * 27500;
    const signDate = daysFrom(base, -220 + index * 8);
    const effectiveDate = daysFrom(signDate, 3);
    const expireDate = resolveExpireDate(base, status, index);
    const name = `${contractNamePrefix(type)}${String(sequence).padStart(2, '0')}`;

    return {
      code: `DEMO-C-${String(sequence).padStart(4, '0')}`,
      name,
      type,
      signSubject: index % 3 === 0 ? '上海星河数字科技有限公司' : '企业内部合同管理中心',
      counterparty: counterparties[index % counterparties.length],
      amount,
      currency: index % 7 === 0 ? '美元' : '人民币',
      signDate,
      effectiveDate,
      expireDate,
      ownerUsername: owner.username,
      ownerName: owner.name,
      status,
      remark: `${type}演示数据，用于合同台账、工作台、提醒、收付款和经营分析联调验收。`,
      attachments: buildAttachments(sequence, type),
      milestones: buildMilestones(base, status, owner.name, index),
      payments: buildPayments(base, status, type, amount, index),
      records: buildRecords(status, owner.name),
    };
  });
  return [...demos, ...buildAccuracyTestContracts(base)];
}

function buildAccuracyTestContracts(base: Date): ContractDemoSeed[] {
  return [
    {
      code: 'TEST-ACC-0001',
      name: '草稿验收合同-IT服务采购',
      type: '采购合同',
      signSubject: '上海星河数字科技有限公司',
      counterparty: '南京博远软件有限公司',
      amount: 100000,
      currency: '人民币',
      signDate: daysFrom(base, -30),
      effectiveDate: daysFrom(base, -27),
      expireDate: daysFrom(base, 180),
      ownerName: '张伟',
      status: '草稿',
      remark: '【准确性测试】草稿状态，无完成收款，预期receivedAmount=0，剩余履约金额=100,000',
      attachments: [{ category: '合同正文', fileName: 'TEST-ACC-0001-合同正文.txt', content: 'TEST-ACC-0001 准确性测试' }],
      milestones: [
        { name: '合同起草审核', planDate: daysFrom(base, 10), ownerName: '张伟', status: '待处理', remark: '待审核' },
        { name: '合同正式签署', planDate: daysFrom(base, 20), ownerName: '张伟', status: '待处理', remark: '待签署' },
      ],
      payments: [
        { direction: '付款', planAmount: 60000, planDate: daysFrom(base, 30), status: '待处理', remark: '首期付款待处理' },
        { direction: '付款', planAmount: 40000, planDate: daysFrom(base, 90), status: '待处理', remark: '末期付款待处理' },
      ],
      records: [{ operType: '合同登记', operTarget: '合同主记录', operatorName: '张伟', operDesc: '准确性测试-草稿合同初始化' }],
    },
    {
      code: 'TEST-ACC-0002',
      name: '履行中验收合同-软件销售服务',
      type: '销售合同',
      signSubject: '企业内部合同管理中心',
      counterparty: '武汉至诚信息技术有限公司',
      amount: 200000,
      currency: '人民币',
      signDate: daysFrom(base, -60),
      effectiveDate: daysFrom(base, -57),
      expireDate: daysFrom(base, 90),
      ownerName: '李华',
      status: '履行中',
      remark: '【准确性测试】履行中：收款80,000已完成，付款50,000不计入，预期剩余履约金额=120,000',
      attachments: [{ category: '合同正文', fileName: 'TEST-ACC-0002-合同正文.txt', content: 'TEST-ACC-0002 准确性测试' }],
      milestones: [
        { name: '合同生效确认', planDate: daysFrom(base, -55), actualDate: daysFrom(base, -54), ownerName: '李华', status: '已完成', remark: '已完成', completeRemark: '生效确认通过' },
        { name: '阶段交付验收', planDate: daysFrom(base, 30), ownerName: '李华', status: '待处理', remark: '等待中期交付' },
      ],
      payments: [
        { direction: '收款', planAmount: 80000, planDate: daysFrom(base, -40), actualAmount: 80000, actualDate: daysFrom(base, -38), status: '已完成', remark: '首期收款已到账，计入剩余履约金额' },
        { direction: '收款', planAmount: 70000, planDate: daysFrom(base, 45), status: '待处理', remark: '末期收款待到账' },
        { direction: '付款', planAmount: 50000, planDate: daysFrom(base, -20), actualAmount: 50000, actualDate: daysFrom(base, -18), status: '已完成', remark: '成本付款已完成，付款方向不计入剩余履约金额' },
      ],
      records: [
        { operType: '合同登记', operTarget: '合同主记录', operatorName: '李华', operDesc: '准确性测试-履行中合同初始化' },
        { operType: '收款登记', operTarget: '首期收款', operatorName: '李华', operDesc: '首期收款80,000到账' },
      ],
    },
    {
      code: 'TEST-ACC-0003',
      name: '已到期验收合同-年度运维服务',
      type: '服务合同',
      signSubject: '企业内部合同管理中心',
      counterparty: '上海云杉科技有限公司',
      amount: 150000,
      currency: '人民币',
      signDate: daysFrom(base, -120),
      effectiveDate: daysFrom(base, -117),
      expireDate: daysFrom(base, -15),
      ownerName: '王芳',
      status: '已到期',
      remark: '【准确性测试】已到期：全部收款逾期未到账，预期receivedAmount=0，剩余履约金额=150,000',
      attachments: [],
      milestones: [
        { name: '合同生效确认', planDate: daysFrom(base, -115), actualDate: daysFrom(base, -114), ownerName: '王芳', status: '已完成', remark: '已完成', completeRemark: '生效确认通过' },
        { name: '服务验收', planDate: daysFrom(base, -20), ownerName: '王芳', status: '逾期', remark: '服务验收已逾期' },
      ],
      payments: [
        { direction: '收款', planAmount: 75000, planDate: daysFrom(base, -30), status: '逾期', remark: '首期收款逾期未到账，无actualAmount' },
        { direction: '收款', planAmount: 50000, planDate: daysFrom(base, -18), status: '逾期', remark: '尾款逾期未到账，无actualAmount' },
        { direction: '付款', planAmount: 30000, planDate: daysFrom(base, -25), status: '逾期', remark: '成本付款逾期，付款方向不计入收款统计' },
      ],
      records: [{ operType: '合同登记', operTarget: '合同主记录', operatorName: '王芳', operDesc: '准确性测试-已到期合同初始化' }],
    },
    {
      code: 'TEST-ACC-0004',
      name: '已终止验收合同-设备租赁',
      type: '租赁合同',
      signSubject: '上海星河数字科技有限公司',
      counterparty: '广州华信办公租赁有限公司',
      amount: 300000,
      currency: '人民币',
      signDate: daysFrom(base, -90),
      effectiveDate: daysFrom(base, -87),
      expireDate: daysFrom(base, 45),
      ownerName: '赵琳',
      status: '已终止',
      remark: '【准确性测试】已终止：收款actual=115,000（计划120,000），付款不计入，预期剩余履约金额=185,000',
      attachments: [{ category: '合同正文', fileName: 'TEST-ACC-0004-合同正文.txt', content: 'TEST-ACC-0004 准确性测试' }],
      milestones: [
        { name: '合同生效确认', planDate: daysFrom(base, -85), actualDate: daysFrom(base, -84), ownerName: '赵琳', status: '已完成', remark: '已完成', completeRemark: '生效确认通过' },
        { name: '终止协议签署', planDate: daysFrom(base, -10), actualDate: daysFrom(base, -9), ownerName: '赵琳', status: '已完成', remark: '合同提前终止', completeRemark: '终止协议已签署' },
      ],
      payments: [
        { direction: '收款', planAmount: 120000, planDate: daysFrom(base, -60), actualAmount: 115000, actualDate: daysFrom(base, -58), status: '已完成', remark: '首期收款实际115,000（计划120,000，折扣5,000）' },
        { direction: '收款', planAmount: 60000, planDate: daysFrom(base, 20), status: '待处理', remark: '续期收款因终止未到账，无actualAmount' },
        { direction: '付款', planAmount: 90000, planDate: daysFrom(base, -50), actualAmount: 90000, actualDate: daysFrom(base, -48), status: '已完成', remark: '成本付款已完成，付款方向不计入剩余履约金额' },
      ],
      records: [
        { operType: '合同登记', operTarget: '合同主记录', operatorName: '赵琳', operDesc: '准确性测试-已终止合同初始化' },
        { operType: '收款登记', operTarget: '首期收款', operatorName: '赵琳', operDesc: '首期收款115,000到账（折扣5,000）' },
        { operType: '状态变更', operTarget: '合同状态', operatorName: '赵琳', operDesc: '合同提前终止' },
      ],
    },
    {
      code: 'TEST-ACC-0005',
      name: '已归档验收合同-战略合作项目',
      type: '框架协议',
      signSubject: '上海星河数字科技有限公司',
      counterparty: '北京星瀚数据服务有限公司',
      amount: 500000,
      currency: '人民币',
      signDate: daysFrom(base, -180),
      effectiveDate: daysFrom(base, -177),
      expireDate: daysFrom(base, -60),
      ownerName: '陈梅',
      status: '已归档',
      remark: '【准确性测试】已归档完整履约：3笔收款actual合计450,000，预期剩余履约金额=50,000',
      attachments: [
        { category: '合同正文', fileName: 'TEST-ACC-0005-合同正文.txt', content: 'TEST-ACC-0005 准确性测试合同正文' },
        { category: '验收材料', fileName: 'TEST-ACC-0005-验收材料.txt', content: 'TEST-ACC-0005 完整履约验收材料' },
      ],
      milestones: [
        { name: '合同生效确认', planDate: daysFrom(base, -175), actualDate: daysFrom(base, -174), ownerName: '陈梅', status: '已完成', remark: '已完成', completeRemark: '生效确认通过' },
        { name: '首期交付验收', planDate: daysFrom(base, -140), actualDate: daysFrom(base, -138), ownerName: '陈梅', status: '已完成', remark: '首期项目交付', completeRemark: '验收通过' },
        { name: '中期交付验收', planDate: daysFrom(base, -100), actualDate: daysFrom(base, -98), ownerName: '陈梅', status: '已完成', remark: '中期项目交付', completeRemark: '验收通过' },
        { name: '归档确认', planDate: daysFrom(base, -65), actualDate: daysFrom(base, -63), ownerName: '陈梅', status: '已完成', remark: '合同完成归档', completeRemark: '归档资料已确认' },
      ],
      payments: [
        { direction: '收款', planAmount: 200000, planDate: daysFrom(base, -150), actualAmount: 200000, actualDate: daysFrom(base, -148), status: '已完成', remark: '首期收款：计划=实际=200,000' },
        { direction: '收款', planAmount: 150000, planDate: daysFrom(base, -110), actualAmount: 145000, actualDate: daysFrom(base, -108), status: '已完成', remark: '中期收款：实际145,000（计划150,000，折扣5,000）' },
        { direction: '收款', planAmount: 100000, planDate: daysFrom(base, -75), actualAmount: 105000, actualDate: daysFrom(base, -73), status: '已完成', remark: '尾款：实际105,000（计划100,000，超额5,000）' },
        { direction: '付款', planAmount: 50000, planDate: daysFrom(base, -120), actualAmount: 50000, actualDate: daysFrom(base, -118), status: '已完成', remark: '合作成本付款，付款方向不计入剩余履约金额' },
      ],
      records: [
        { operType: '合同登记', operTarget: '合同主记录', operatorName: '陈梅', operDesc: '准确性测试-已归档合同初始化' },
        { operType: '收款登记', operTarget: '首期收款', operatorName: '陈梅', operDesc: '首期收款200,000到账' },
        { operType: '收款登记', operTarget: '中期收款', operatorName: '陈梅', operDesc: '中期收款145,000到账' },
        { operType: '收款登记', operTarget: '尾款', operatorName: '陈梅', operDesc: '尾款105,000到账' },
        { operType: '节点完成', operTarget: '归档确认', operatorName: '陈梅', operDesc: '合同归档完成，全部履约完毕' },
      ],
    },
  ];
}

function contractNamePrefix(type: string) {
  const map: Record<string, string> = {
    采购合同: '办公设备采购合同',
    销售合同: '年度软件销售合同',
    服务合同: '运维服务合同',
    租赁合同: '办公场地租赁合同',
    框架协议: '战略合作框架协议',
    其他合同: '专项业务合作合同',
  };
  return map[type] || '合同';
}

function resolveExpireDate(base: Date, status: string, index: number) {
  if (status === '已到期') return daysFrom(base, -8 - index);
  if (status === '已终止') return daysFrom(base, 45 + index);
  if (status === '已归档') return daysFrom(base, -90 - index);
  if (status === '草稿') return daysFrom(base, 120 + index);
  return daysFrom(base, index % 2 === 0 ? 18 + index : 75 + index);
}

function buildAttachments(sequence: number, type: string): ContractDemoAttachmentSeed[] {
  if (sequence > 16) return [];
  const suffix = String(sequence).padStart(4, '0');
  const attachments: ContractDemoAttachmentSeed[] = [
    {
      category: '合同正文',
      fileName: `DEMO-C-${suffix}-合同正文.txt`,
      content: `DEMO-C-${suffix} ${type}合同正文占位文件，仅用于本地演示下载验证。`,
    },
  ];

  if (sequence % 3 === 0) {
    attachments.push({
      category: '验收材料',
      fileName: `DEMO-C-${suffix}-验收材料.txt`,
      content: `DEMO-C-${suffix} 验收材料占位文件，用于附件分类展示。`,
    });
  }

  return attachments;
}

function buildMilestones(base: Date, status: string, ownerName: string, index: number): ContractDemoMilestoneSeed[] {
  const finished = status === '已归档' || status === '已终止';
  const overdue = status === '已到期';
  const firstPlanDate = daysFrom(base, overdue ? -20 - index : -18 + index);
  const secondPlanDate = daysFrom(base, overdue ? -5 : 20 + index);

  return [
    {
      name: '合同生效确认',
      planDate: firstPlanDate,
      actualDate: status === '草稿' ? undefined : daysFrom(firstPlanDate, 1),
      ownerName,
      status: status === '草稿' ? '待处理' : '已完成',
      remark: '确认合同基础信息、生效日期和业务负责人。',
      completeRemark: status === '草稿' ? undefined : '已完成生效确认。',
    },
    {
      name: finished ? '归档确认' : '阶段履约验收',
      planDate: secondPlanDate,
      actualDate: finished ? daysFrom(secondPlanDate, -1) : undefined,
      ownerName,
      status: finished ? '已完成' : overdue ? '逾期' : '待处理',
      remark: finished ? '确认合同资料齐全并归档。' : '跟进阶段性交付与验收结果。',
      completeRemark: finished ? '归档资料已确认。' : undefined,
    },
  ];
}

function buildPayments(base: Date, status: string, type: string, amount: number, index: number): ContractDemoPaymentSeed[] {
  const receiveFirst = type === '销售合同' || type === '服务合同' || type === '框架协议';
  const primaryDirection = receiveFirst ? '收款' : '付款';
  const secondaryDirection = receiveFirst ? '付款' : '收款';
  const overdue = status === '已到期';
  const finished = status === '已归档' || status === '已终止';
  const firstAmount = roundAmount(amount * 0.45);
  const secondAmount = roundAmount(amount * 0.35);
  const firstPlanDate = daysFrom(base, overdue ? -25 : -12 + index);
  const secondPlanDate = daysFrom(base, overdue ? -3 : 35 + index);

  return [
    {
      direction: primaryDirection,
      planAmount: firstAmount,
      planDate: firstPlanDate,
      actualAmount: status === '草稿' || overdue ? undefined : firstAmount,
      actualDate: status === '草稿' || overdue ? undefined : daysFrom(firstPlanDate, 2),
      status: status === '草稿' ? '待处理' : overdue ? '逾期' : '已完成',
      remark: '首期款项演示数据。',
    },
    {
      direction: secondaryDirection,
      planAmount: secondAmount,
      planDate: secondPlanDate,
      actualAmount: finished ? secondAmount : undefined,
      actualDate: finished ? daysFrom(secondPlanDate, 1) : undefined,
      status: finished ? '已完成' : overdue ? '逾期' : '待处理',
      remark: '阶段款项演示数据。',
    },
  ];
}

function buildRecords(status: string, ownerName: string): ContractDemoRecordSeed[] {
  const records: ContractDemoRecordSeed[] = [
    {
      operType: '合同登记',
      operTarget: '合同主记录',
      operatorName: ownerName,
      operDesc: '初始化合同演示数据。',
    },
  ];

  if (status !== '草稿') {
    records.push({
      operType: '节点完成',
      operTarget: '合同生效确认',
      operatorName: ownerName,
      operDesc: '生效确认节点已完成。',
    });
  }

  return records;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysFrom(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}
