/**
 * ETF联接基金 → 目标ETF 映射表
 *
 * key: 场外联接基金代码
 * value: { etfCode: 场内ETF代码, market: 1(沪市) | 0(深市), name: 目标ETF名称 }
 *
 * 数据来源：天天基金/东方财富公开信息
 * 更新维护：新增联接基金时手动补充
 */
export const ETF_FEEDER_MAP = {
  // === 沪深300 ETF联接 ===
  '110020': { etfCode: '510300', market: 1, name: '华泰柏瑞沪深300ETF' },
  '000311': { etfCode: '510300', market: 1, name: '景顺长城沪深300ETF' },
  '000312': { etfCode: '510300', market: 1, name: '景顺长城沪深300ETF联接A' },
  '005918': { etfCode: '510300', market: 1, name: '天弘沪深300ETF联接A' },
  '005919': { etfCode: '510300', market: 1, name: '天弘沪深300ETF联接C' },

  // === 中证500 ETF联接 ===
  '162711': { etfCode: '510500', market: 1, name: '广发中证500ETF联接(LOF)A' },
  '001478': { etfCode: '510500', market: 1, name: '广发中证500ETF联接(LOF)C' },
  '000478': { etfCode: '510500', market: 1, name: '建信中证500ETF联接A' },
  '005794': { etfCode: '510500', market: 1, name: '建信中证500ETF联接C' },

  // === 创业板 ETF联接 ===
  '110026': { etfCode: '159915', market: 0, name: '易方达创业板ETF联接A' },
  '004744': { etfCode: '159915', market: 0, name: '易方达创业板ETF联接C' },
  '006609': { etfCode: '159915', market: 0, name: '天弘创业板ETF联接A' },
  '006610': { etfCode: '159915', market: 0, name: '天弘创业板ETF联接C' },

  // === 科创板50 ETF联接 ===
  '011611': { etfCode: '588000', market: 1, name: '华夏科创50ETF联接A' },
  '011612': { etfCode: '588000', market: 1, name: '华夏科创50ETF联接C' },
  '011613': { etfCode: '588000', market: 1, name: '易方达科创50ETF联接A' },
  '011614': { etfCode: '588000', market: 1, name: '易方达科创50ETF联接C' },

  // === 中证A500 ETF联接（已验证）===
  '019510': { etfCode: '563500', market: 1, name: '华宝中证A500ETF' },
  '019511': { etfCode: '563500', market: 1, name: '华宝中证A500ETF' },
  '022430': { etfCode: '512050', market: 1, name: '华夏中证A500ETF' },
  '022431': { etfCode: '512050', market: 1, name: '华夏中证A500ETF' },
  '022434': { etfCode: '159352', market: 0, name: '南方中证A500ETF' },
  '022435': { etfCode: '159352', market: 0, name: '南方中证A500ETF' },
  '022438': { etfCode: '563360', market: 1, name: '华泰柏瑞中证A500ETF' },
  '022439': { etfCode: '563360', market: 1, name: '华泰柏瑞中证A500ETF' },
  '022424': { etfCode: '563800', market: 1, name: '广发中证A500ETF' },
  '022425': { etfCode: '563800', market: 1, name: '广发中证A500ETF' },
  '022428': { etfCode: '159360', market: 0, name: '天弘中证A500ETF' },
  '022429': { etfCode: '159360', market: 0, name: '天弘中证A500ETF' },
  '022465': { etfCode: '159359', market: 0, name: '华安中证A500ETF' },
  '022466': { etfCode: '159359', market: 0, name: '华安中证A500ETF' },
  '022463': { etfCode: '563220', market: 1, name: '富国中证A500ETF' },
  '022464': { etfCode: '563220', market: 1, name: '富国中证A500ETF' },

  // === 科创创业50(双创50) ETF联接（已验证）===
  '013304': { etfCode: '159780', market: 0, name: '科创创业50ETF南方' },
  '013305': { etfCode: '159780', market: 0, name: '科创创业50ETF南方' },
  '013310': { etfCode: '159783', market: 0, name: '科创创业50ETF华夏' },
  '013311': { etfCode: '159783', market: 0, name: '科创创业50ETF华夏' },
  '013298': { etfCode: '159780', market: 0, name: '科创创业50ETF南方' },
  '013299': { etfCode: '159780', market: 0, name: '科创创业50ETF南方' },
  '013313': { etfCode: '588350', market: 1, name: '科创创业50ETF鹏扬' },
  '013314': { etfCode: '588350', market: 1, name: '科创创业50ETF鹏扬' },
  '013315': { etfCode: '588300', market: 1, name: '科创创业50ETF招商' },
  '013316': { etfCode: '588300', market: 1, name: '科创创业50ETF招商' },
  '013317': { etfCode: '588330', market: 1, name: '双创50ETF华宝' },
  '013318': { etfCode: '588330', market: 1, name: '双创50ETF华宝' },
  '012894': { etfCode: '159782', market: 0, name: '双创50ETF银华' },
  '012895': { etfCode: '159782', market: 0, name: '双创50ETF银华' },

  // === 创业板50 ETF联接（已验证）===
  '160422': { etfCode: '159949', market: 0, name: '创业板50ETF华安' },
  '160424': { etfCode: '159949', market: 0, name: '创业板50ETF华安' },
  '017949': { etfCode: '159682', market: 0, name: '创业板50ETF景顺' },
  '017950': { etfCode: '159682', market: 0, name: '创业板50ETF景顺' },
  '018482': { etfCode: '159681', market: 0, name: '创业板50ETF鹏华' },
  '018483': { etfCode: '159681', market: 0, name: '创业板50ETF鹏华' },
  '023830': { etfCode: '159383', market: 0, name: '创业板50ETF华泰柏瑞' },
  '023831': { etfCode: '159383', market: 0, name: '创业板50ETF华泰柏瑞' },

  // === 科创综指 ETF联接 ===
  // 注意：目前尚无科创综指联接基金，只有场内ETF（589000等）

  // === 中证1000 ETF联接 ===
  '005101': { etfCode: '560010', market: 1, name: '广发中证1000ETF联接A' },
  '005102': { etfCode: '560010', market: 1, name: '广发中证1000ETF联接C' },
  '013493': { etfCode: '560010', market: 1, name: '南方中证1000ETF联接A' },
  '013494': { etfCode: '560010', market: 1, name: '南方中证1000ETF联接C' },

  // === 医药ETF联接 ===
  '000311': { etfCode: '512010', market: 1, name: '易方达沪深300医药ETF' },
  '006938': { etfCode: '512010', market: 1, name: '鹏华中证医药ETF联接A' },
  '006939': { etfCode: '512010', market: 1, name: '鹏华中证医药ETF联接C' },

  // === 消费ETF联接 ===
  '000248': { etfCode: '159928', market: 0, name: '汇添富中证主要消费ETF联接' },

  // === 恒生ETF联接 ===
  '000075': { etfCode: '159920', market: 0, name: '华夏恒生ETF联接(QDII)A' },
  '000076': { etfCode: '159920', market: 0, name: '华夏恒生ETF联接(QDII)C' },

  // === 纳指ETF联接 ===
  '000614': { etfCode: '513100', market: 1, name: '广发纳斯达克100ETF联接(QDII)A' },
  '006479': { etfCode: '513100', market: 1, name: '广发纳斯达克100ETF联接(QDII)C' },
  '000834': { etfCode: '159941', market: 0, name: '广发纳斯达克100ETF' },

  // === 日经ETF ===
  '000095': { etfCode: '513520', market: 1, name: '华夏野村日经225ETF' },

  // === 黄金ETF联接 ===
  '000216': { etfCode: '518880', market: 1, name: '华安黄金易ETF联接A' },
  '000217': { etfCode: '518880', market: 1, name: '华安黄金易ETF联接C' },
  '000307': { etfCode: '159934', market: 0, name: '易方达黄金ETF联接A' },
  '003351': { etfCode: '159934', market: 0, name: '易方达黄金ETF联接C' },

  // === 证券ETF联接 ===
  '006380': { etfCode: '512880', market: 1, name: '国泰中证全指证券公司ETF联接A' },
  '006381': { etfCode: '512880', market: 1, name: '国泰中证全指证券公司ETF联接C' },

  // === 银行ETF联接 ===
  '007402': { etfCode: '512800', market: 1, name: '华宝中证银行ETF联接A' },
  '007403': { etfCode: '512800', market: 1, name: '华宝中证银行ETF联接C' },

  // === 军工ETF联接 ===
  '003017': { etfCode: '512660', market: 1, name: '广发中证军工ETF联接A' },
  '003018': { etfCode: '512660', market: 1, name: '广发中证军工ETF联接C' },

  // === 芯片ETF联接 ===
  '007622': { etfCode: '159995', market: 0, name: '国联安中证全指半导体ETF联接A' },
  '007623': { etfCode: '159995', market: 0, name: '国联安中证全指半导体ETF联接C' },
  '012638': { etfCode: '159995', market: 0, name: '华夏国证半导体芯片ETF联接A' },
  '012639': { etfCode: '159995', market: 0, name: '华夏国证半导体芯片ETF联接C' },

  // === 新能源车ETF联接 ===
  '003790': { etfCode: '515030', market: 1, name: '华夏中证新能源汽车ETF联接A' },
  '003791': { etfCode: '515030', market: 1, name: '华夏中证新能源汽车ETF联接C' },

  // === 光伏ETF联接 ===
  '011102': { etfCode: '515790', market: 1, name: '华泰柏瑞中证光伏产业ETF联接A' },
  '011103': { etfCode: '515790', market: 1, name: '华泰柏瑞中证光伏产业ETF联接C' },

  // === 红利ETF联接 ===
  '000072': { etfCode: '510880', market: 1, name: '华泰柏瑞上证红利ETF联接' },
  '005125': { etfCode: '510880', market: 1, name: '景顺长城中证红利低波动100ETF联接A' },
  '005126': { etfCode: '510880', market: 1, name: '景顺长城中证红利低波动100ETF联接C' },

  // === 环保ETF联接 ===
  '001977': { etfCode: '512580', market: 1, name: '广发中证环保产业ETF联接A' },
  '001978': { etfCode: '512580', market: 1, name: '广发中证环保产业ETF联接C' },

  // === 互联网ETF联接 ===
  '001481': { etfCode: '159941', market: 0, name: '广发中证全指信息技术ETF联接A' },
  '001482': { etfCode: '159941', market: 0, name: '广发中证全指信息技术ETF联接C' },
};

/**
 * 判断某基金是否为 ETF联接基金
 */
export function isEtfFeederFund(fundCode) {
  return Object.prototype.hasOwnProperty.call(ETF_FEEDER_MAP, fundCode);
}

/**
 * 获取 ETF联接基金对应的目标ETF信息
 * @param {string} fundCode - 基金代码
 * @returns {{ etfCode: string, market: number, name: string } | null}
 */
export function getTargetEtf(fundCode) {
  const info = ETF_FEEDER_MAP[fundCode];
  if (!info) return null;
  return { ...info };
}

/**
 * 构建 secid 格式（东方财富需要的参数）
 * @param {string} fundCode - 基金代码
 * @returns {string | null} 如 "1.510300" 或 null
 */
export function getEtfSecid(fundCode) {
  const info = ETF_FEEDER_MAP[fundCode];
  if (!info) return null;
  return `${info.market}.${info.etfCode}`;
}
