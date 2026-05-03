import { useMemo, useCallback } from 'react';
import { isPlainObject } from 'lodash';

// 排序规则类型
export const SORT_TYPES = {
  VALUATION: 'valuation', // 估值涨跌幅
  HOLDING_PROFIT: 'holdingProfit', // 持仓收益
  HOLDING_AMOUNT: 'holdingAmount', // 持有金额
  YIELD: 'yield', // 收益率
  NAME: 'name', // 基金名称
  CODE: 'code', // 基金代码
  ADD_TIME: 'addTime', // 添加时间
  CUSTOM: 'custom', // 自定义
  TAG: 'tag', // 标签
};

// 排序方向
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
};

// 默认排序规则
export const DEFAULT_SORT_RULES = [
  { id: SORT_TYPES.VALUATION, enabled: true, order: SORT_ORDERS.DESC },
  { id: SORT_TYPES.HOLDING_PROFIT, enabled: false, order: SORT_ORDERS.DESC },
];

/**
 * 管理基金排序
 * @param {Array} funds - 基金列表
 * @param {Array} sortRules - 排序规则列表
 * @param {Object} options - 额外选项
 */
export function useFundSorting(funds, sortRules, options = {}) {
  const {
    holdings = {},
    fundTagListsByCode = {},
    groupId = null,
    customOrder = [],
  } = options;

  // 合并排序规则与默认值
  const mergedSortRules = useMemo(() => {
    const rulesFromSettings = sortRules || [];
    const defaultRulesMap = new Map(DEFAULT_SORT_RULES.map((r) => [r.id, r]));
    const incomingMap = new Map(rulesFromSettings.map((r) => [r.id, r]));

    // 合并：先放传入的规则，再放默认规则中未启用的
    const result = [];
    for (const r of rulesFromSettings) {
      if (r && r.id) {
        result.push({
          ...defaultRulesMap.get(r.id),
          ...r,
        });
      }
    }
    for (const r of DEFAULT_SORT_RULES) {
      if (!incomingMap.has(r.id)) {
        result.push({ ...r });
      }
    }
    return result;
  }, [sortRules]);

  // 获取启用的排序规则
  const enabledSortRules = useMemo(() => {
    return mergedSortRules.filter((r) => r.enabled);
  }, [mergedSortRules]);

  // 排序函数
  const sortFunds = useCallback(
    (fundList) => {
      if (!fundList || fundList.length === 0) return [];

      const enabledRules = enabledSortRules;

      // 如果没有启用的规则，使用自定义顺序或保持原序
      if (enabledRules.length === 0) {
        if (customOrder && customOrder.length > 0) {
          const orderMap = new Map(customOrder.map((code, idx) => [code, idx]));
          return [...fundList].sort(
            (a, b) => (orderMap.get(a.code) ?? Infinity) - (orderMap.get(b.code) ?? Infinity)
          );
        }
        return [...fundList];
      }

      return [...fundList].sort((a, b) => {
        for (const rule of enabledRules) {
          const comparison = compareFundsByRule(
            a,
            b,
            rule.id,
            rule.order,
            holdings,
            fundTagListsByCode,
            groupId
          );
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    },
    [enabledSortRules, customOrder, holdings, fundTagListsByCode, groupId]
  );

  // 排序后的基金列表
  const sortedFunds = useMemo(() => {
    return sortFunds(funds);
  }, [sortFunds, funds]);

  return {
    sortedFunds,
    mergedSortRules,
    enabledSortRules,
    sortFunds,
  };
}

/**
 * 根据单条规则比较两只基金
 * @returns {number} -1, 0, 或 1
 */
function compareFundsByRule(
  a,
  b,
  ruleId,
  order,
  holdings,
  fundTagListsByCode,
  groupId
) {
  const isAsc = order === SORT_ORDERS.ASC;
  const multiplier = isAsc ? 1 : -1;

  switch (ruleId) {
    case SORT_TYPES.VALUATION:
      return compareByNumber(
        getValuationChange(a),
        getValuationChange(b),
        multiplier
      );

    case SORT_TYPES.HOLDING_PROFIT:
      return compareByNumber(
        getHoldingProfitValue(a, holdings, groupId),
        getHoldingProfitValue(b, holdings, groupId),
        multiplier
      );

    case SORT_TYPES.HOLDING_AMOUNT:
      return compareByNumber(
        getHoldingAmount(a, holdings, groupId),
        getHoldingAmount(b, holdings, groupId),
        multiplier
      );

    case SORT_TYPES.YIELD:
      return compareByNumber(
        getYieldRate(a, holdings, groupId),
        getYieldRate(b, holdings, groupId),
        multiplier
      );

    case SORT_TYPES.NAME:
      return multiplier * String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');

    case SORT_TYPES.CODE:
      return multiplier * String(a.code || '').localeCompare(String(b.code || ''));

    case SORT_TYPES.ADD_TIME:
      return compareByNumber(
        a.addTime || a._addTime || 0,
        b.addTime || b._addTime || 0,
        multiplier
      );

    case SORT_TYPES.TAG:
      return compareByTag(a, b, fundTagListsByCode, multiplier);

    default:
      return 0;
  }
}

// 获取估值涨跌幅
function getValuationChange(fund) {
  if (!fund) return null;
  // 优先使用 gszzl（估值涨跌幅）
  if (fund.gszzl != null) return Number(fund.gszzl);
  // 其次计算 (gsz - dwjz) / dwjz
  if (fund.gsz != null && fund.dwjz != null && Number(fund.dwjz) > 0) {
    return ((Number(fund.gsz) - Number(fund.dwjz)) / Number(fund.dwjz)) * 100;
  }
  return null;
}

// 获取持仓收益值
function getHoldingProfitValue(fund, holdings, groupId) {
  if (!fund?.code) return null;
  const holding = getHoldingForScope(fund.code, holdings, groupId);
  if (!holding) return null;

  const share = Number(holding.share);
  const cost = Number(holding.cost);
  const currentNav =
    fund.gsz != null ? Number(fund.gsz) : fund.dwjz != null ? Number(fund.dwjz) : null;

  if (!share || !cost || !currentNav) return null;

  return share * (currentNav - cost);
}

// 获取持仓金额
function getHoldingAmount(fund, holdings, groupId) {
  if (!fund?.code) return null;
  const holding = getHoldingForScope(fund.code, holdings, groupId);
  if (!holding) return null;

  const share = Number(holding.share);
  const currentNav =
    fund.gsz != null ? Number(fund.gsz) : fund.dwjz != null ? Number(fund.dwjz) : null;

  if (!share || !currentNav) return null;

  return share * currentNav;
}

// 获取收益率
function getYieldRate(fund, holdings, groupId) {
  if (!fund?.code) return null;
  const holding = getHoldingForScope(fund.code, holdings, groupId);
  if (!holding) return null;

  const share = Number(holding.share);
  const cost = Number(holding.cost);
  const currentNav =
    fund.gsz != null ? Number(fund.gsz) : fund.dwjz != null ? Number(fund.dwjz) : null;

  if (!share || !cost || !currentNav || cost <= 0) return null;

  return ((currentNav - cost) / cost) * 100;
}

// 根据分组/全局获取持仓
function getHoldingForScope(code, holdings, groupId) {
  if (!code || !holdings) return null;

  // 如果有分组ID，优先从分组持仓获取
  if (groupId && groupId !== 'global') {
    // groupHoldings 需要另外传入，这里简化处理
  }

  return holdings[code];
}

// 比较数值
function compareByNumber(a, b, multiplier) {
  // 处理 null/undefined
  if (a == null && b == null) return 0;
  if (a == null) return multiplier * 1; // null 放在后面
  if (b == null) return multiplier * -1;

  const numA = Number(a);
  const numB = Number(b);

  if (Number.isNaN(numA) && Number.isNaN(numB)) return 0;
  if (Number.isNaN(numA)) return multiplier * 1;
  if (Number.isNaN(numB)) return multiplier * -1;

  if (numA === numB) return 0;
  return multiplier * (numA > numB ? 1 : -1);
}

// 按标签比较
function compareByTag(a, b, fundTagListsByCode, multiplier) {
  const tagsA = fundTagListsByCode?.[a?.code] || [];
  const tagsB = fundTagListsByCode?.[b?.code] || [];

  const nameA = tagsA[0]?.name || '';
  const nameB = tagsB[0]?.name || '';

  // 有标签的排在前面
  if (!nameA && nameB) return multiplier * 1;
  if (nameA && !nameB) return multiplier * -1;

  return multiplier * nameA.localeCompare(nameB, 'zh-CN');
}

/**
 * 解析排序设置字符串
 * @param {string} sortBy - 排序字段
 * @param {string} sortOrder - 排序方向
 * @returns {Array} 排序规则数组
 */
export function parseSortSettings(sortBy, sortOrder) {
  if (!sortBy) return DEFAULT_SORT_RULES;

  return [
    {
      id: sortBy,
      enabled: true,
      order: sortOrder === SORT_ORDERS.ASC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC,
    },
  ];
}

/**
 * 序列化排序规则为存储格式
 * @param {Array} rules - 排序规则数组
 * @returns {Object} { sortBy, sortOrder }
 */
export function serializeSortSettings(rules) {
  const enabledRule = (rules || []).find((r) => r.enabled);
  if (!enabledRule) {
    return { sortBy: '', sortOrder: SORT_ORDERS.DESC };
  }
  return {
    sortBy: enabledRule.id,
    sortOrder: enabledRule.order || SORT_ORDERS.DESC,
  };
}
