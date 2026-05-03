import { useMemo, useCallback } from 'react';
import { isNumber, isPlainObject } from 'lodash';
import {
  DCA_SCOPE_GLOBAL,
  SUMMARY_TAB_ID,
  SUMMARY_SOURCE_GLOBAL,
  cloneHoldingDeep,
  normalizeHoldingEntryForSeed,
  seedGroupHoldingsFromGlobal,
  hasOwn,
} from '../lib/fundHelpers';

export {
  DCA_SCOPE_GLOBAL,
  SUMMARY_TAB_ID,
  SUMMARY_SOURCE_GLOBAL,
  cloneHoldingDeep,
  normalizeHoldingEntryForSeed,
  seedGroupHoldingsFromGlobal,
  hasOwn,
};

/**
 * 管理持仓收益计算
 */
export function useHoldingCalculations() {
  // 计算持仓收益
  const getHoldingProfit = useCallback((fund, holding, scopeGroupIdOverride) => {
    if (!fund || !holding) return null;

    const { share, cost, gid: holdingGid } = holding;
    if (
      share == null ||
      cost == null ||
      !isNumber(Number(share)) ||
      !isNumber(Number(cost))
    ) {
      return null;
    }

    const numShare = Number(share);
    const numCost = Number(cost);

    if (numShare <= 0 || numCost <= 0) return null;

    // 获取当前净值（优先使用估值，其次单位净值）
    const currentNav =
      fund.gsz != null && Number(fund.gsz) > 0
        ? Number(fund.gsz)
        : fund.dwjz != null && Number(fund.dwjz) > 0
        ? Number(fund.dwjz)
        : null;

    if (currentNav == null || !isNumber(currentNav)) return null;

    const marketValue = numShare * currentNav;
    const costValue = numShare * numCost;
    const profit = marketValue - costValue;
    const profitRate = costValue > 0 ? (profit / costValue) * 100 : 0;

    return {
      share: numShare,
      cost: numCost,
      marketValue,
      costValue,
      profit,
      profitRate,
      currentNav,
    };
  }, []);

  // 计算持仓成本
  const getCost = useCallback((holding) => {
    if (
      holding?.cost != null &&
      holding?.share != null &&
      isNumber(Number(holding.cost)) &&
      isNumber(Number(holding.share))
    ) {
      return Number(holding.cost) * Number(holding.share);
    }
    return null;
  }, []);

  // 计算收益率值（用于排序）
  const getYieldValue = useCallback((fund, holding) => {
    if (!fund || !holding) return null;
    const profit = getHoldingProfit(fund, holding);
    if (!profit) return null;
    return profit.profitRate;
  }, [getHoldingProfit]);

  // 计算估算收益值（用于排序）
  const getEstimateProfitValue = useCallback((fund, holding) => {
    if (!fund || !holding) return null;
    const profit = getHoldingProfit(fund, holding);
    if (!profit) return null;
    return profit.profit;
  }, [getHoldingProfit]);

  // 获取昨日收益
  const getYesterdayProfit = useCallback((code, jzrq, holdings, fundDailyEarnings) => {
    if (!code) return null;

    // 从日收益记录中查找
    if (fundDailyEarnings && isPlainObject(fundDailyEarnings)) {
      const earnings = fundDailyEarnings[code];
      if (earnings && isNumber(Number(earnings))) {
        return Number(earnings);
      }
    }

    // 尝试从持仓中计算
    const holding = holdings?.[code];
    if (!holding || !isPlainObject(holding)) return null;

    const { share } = holding;
    if (!isNumber(Number(share)) || Number(share) <= 0) return null;

    // 这里需要基金的昨日净值来计算
    return null;
  }, []);

  return {
    getHoldingProfit,
    getCost,
    getYieldValue,
    getEstimateProfitValue,
    getYesterdayProfit,
  };
}

/**
 * 管理分组持仓
 * @param {Array} groups - 分组列表
 * @param {Object} groupHoldings - 分组持仓映射
 * @param {Array} funds - 基金列表
 */
export function useGroupHoldings(groups, groupHoldings, funds) {
  // 计算有持仓的分组
  const groupsWithHoldings = useMemo(() => {
    return (groups || []).filter((g) => {
      if (!g?.id) return false;
      const holdings = groupHoldings?.[g.id];
      if (!holdings || !isPlainObject(holdings)) return false;
      return Object.values(holdings).some(
        (h) => h && isPlainObject(h) && Number(h.share) > 0
      );
    });
  }, [groups, groupHoldings]);

  // 获取指定分组下某只基金的持仓
  const getScopedHolding = useCallback(
    (code, groupId, fallbackToGlobal = true) => {
      if (!code) return null;

      // 优先从分组持仓获取
      if (groupId && groupId !== DCA_SCOPE_GLOBAL) {
        const groupHolding = groupHoldings?.[groupId]?.[code];
        if (groupHolding && isPlainObject(groupHolding)) {
          return groupHolding;
        }
      }

      // 回退到全局持仓
      if (fallbackToGlobal) {
        // 这里需要传入全局 holdings
      }

      return null;
    },
    [groupHoldings]
  );

  // 获取分组下的基金列表
  const getGroupFunds = useCallback(
    (groupId) => {
      const group = groups?.find((g) => g.id === groupId);
      if (!group?.codes) return [];
      return (funds || []).filter((f) => group.codes.includes(f.code));
    },
    [groups, funds]
  );

  return {
    groupsWithHoldings,
    getScopedHolding,
    getGroupFunds,
  };
}
