/**
 * AI 纯逻辑单元验证脚本
 *
 * 覆盖枚举模糊匹配与密钥加解密/脱敏的核心逻辑（不依赖数据库或网络）。
 * 运行：npx ts-node scripts/verify-ai-units.ts
 * 全部通过退出码 0，任一失败退出码 1。
 */
import { matchContractType, matchCurrency } from '../src/modules/ai/agent/enum-matcher';
import { CryptoService } from '../src/modules/ai/services/crypto.service';

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    process.stdout.write(`✓ ${name}\n`);
  } else {
    failed++;
    process.stderr.write(`✗ ${name} | 期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}\n`);
  }
}

function checkTrue(name: string, cond: boolean) {
  check(name, cond, true);
}

// ===== 合同类型模糊匹配 =====
check('类型-完全匹配', matchContractType('服务合同'), '服务合同');
check('类型-技术服务归服务', matchContractType('技术服务合同'), '服务合同');
check('类型-采购关键词', matchContractType('设备采购协议'), '采购合同');
check('类型-销售关键词', matchContractType('产品销售合同'), '销售合同');
check('类型-租赁关键词', matchContractType('房屋租赁合同'), '租赁合同');
check('类型-框架关键词', matchContractType('战略合作框架协议'), '框架协议');
check('类型-含合同但无具体归其他', matchContractType('保密合同'), '其他合同');
check('类型-完全无关返回null', matchContractType('一份文档'), null);
check('类型-空值返回null', matchContractType(''), null);
check('类型-null返回null', matchContractType(null), null);

// ===== 币种模糊匹配 =====
check('币种-完全匹配', matchCurrency('美元'), '美元');
check('币种-RMB归人民币', matchCurrency('RMB'), '人民币');
check('币种-USD归美元', matchCurrency('USD'), '美元');
check('币种-EUR归欧元', matchCurrency('EUR'), '欧元');
check('币种-符号¥', matchCurrency('¥'), '人民币');
check('币种-日元不误判人民币', matchCurrency('日元'), null);
check('币种-港元不误判人民币', matchCurrency('港元'), null);
check('币种-人民币元字样', matchCurrency('人民币'), '人民币');
check('币种-空返回null', matchCurrency(''), null);

// ===== 密钥加解密与脱敏 =====
const crypto = new CryptoService();
const plain = 'sk-1234567890abcdefghij';
const encrypted = crypto.encrypt(plain);
checkTrue('加密-密文非明文', encrypted !== plain && encrypted.length > 0);
checkTrue('加密-可识别为密文', crypto.isEncrypted(encrypted));
check('解密-往返一致', crypto.decrypt(encrypted), plain);
check('加密-空串返回空', crypto.encrypt(''), '');
check('解密-空串返回空', crypto.decrypt(''), '');
check('解密-非法格式返回空', crypto.decrypt('not-a-cipher'), '');
checkTrue('加密-每次IV不同', crypto.encrypt(plain) !== crypto.encrypt(plain));
check('脱敏-保留首尾', crypto.mask(plain), 'sk-***hij');
check('脱敏-短串全掩', crypto.mask('abc'), '***');
check('脱敏-空串返回空', crypto.mask(''), '');
checkTrue('脱敏-不含中间明文', !crypto.mask(plain).includes('1234567890'));

process.stdout.write(`\n通过 ${passed} / ${passed + failed}，失败 ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
