import { useMemo, useCallback } from 'react';
import { isNumber, isPlainObject, isString } from 'lodash';
import dayjs from 'dayjs';
import { toTz } from '../lib/fundHelpers';

// 常量定义
export const DCA_SCOPE_GLOBAL = '__global__';
export const SUMMARY_TAB_ID = '__portfolio_groups_summary__';
export const SUMMARY_SOURCE_GLOBAL = '__portfolio_summary_global__';

/**
 * 增强版持仓计算 Hook
 * @param {Object} options - 配置选项
 */
export function useHoldingsEnhanced(options = {}) {
  const {
    funds = [],
    holdings = {},
    groupHoldings = {},
    groups = [],
    transactions = {},
    activeGroupId = null,
    isTradingDay = true,
    todayStr = dayjs().format('YYYY-MM-DD'),
  } = options;

  /**
   * 计算持仓收益（完整版）
   * 支持：当日收益计算、交易记录处理、分组作用域
   */
  const getHoldingProfit = useCallback((fund, holding, scopeGroupIdOverride) => {
    if (!holding || !isNumber(holding.share)) return null;

    const txScope = scopeGroupIdOverride !== undefined ? scopeGroupIdOverride : activeGroupId;

    const hasTodayData = fund.jzrq === todayStr;
    const hasTodayValuation = isString(fund.gztime) && fund.gztime.startsWith(todayStr);
    const canCalcTodayProfit = hasTodayData || hasTodayValuation;

    // 如果是交易日且9点以后，且今日净值未出，则强制使用估值
    const useValuation = isTradingDay && !hasTodayData;

    let currentNav;
    let profitToday;
    let shareForTodayProfit = holding.share;

    // 处理当日交易记录
    if (canCalcTodayProfit) {
      // 当日收益口径：按"昨日收盘时持有份额"计算
      // 份额基数 = 当前份额 - 当日买入份额 + 当日卖出份额
      let buyToday = 0;
      let sellToday = 0;
      const list = transactions && fund?.code ? (transactions[fund.code] || []) : [];

      for (const tx of list) {
        if (!tx || tx.date !== todayStr) continue;
        const gid = tx.groupId || null;
        if (txScope) {
          if (gid !== txScope) continue;
        } else {
          if (gid) continue;
        }
        const s = Number(tx.share);
        if (!Number.isFinite(s) || s <= 0) continue;
        if (tx.type === 'buy') buyToday += s;
        else if (tx.type === 'sell') sellToday += s;
      }
      shareForTodayProfit = Math.max(0, holding.share - buyToday + sellToday);
    }

    if (!useValuation) {
      // 使用确权净值 (dwjz)
      currentNav = Number(fund.dwjz);
      if (!currentNav) return null;

      if (canCalcTodayProfit) {
        const amount = shareForTodayProfit * currentNav;
        // 优先使用昨日净值直接计算
        const lastNav = fund.lastNav != null && fund.lastNav !== '' ? Number(fund.lastNav) : null;
        if (lastNav && Number.isFinite(lastNav) && lastNav > 0) {
          profitToday = (currentNav - lastNav) * shareForTodayProfit;
        } else {
          const gz = isString(fund.gztime) ? toTz(fund.gztime) : null;
          const jz = isString(fund.jzrq) ? toTz(fund.jzrq) : null;
          const preferGszzl =
            !!gz &&
            !!jz &&
            gz.isValid() &&
            jz.isValid() &&
            gz.startOf('day').isAfter(jz.startOf('day'));

          let rate;
          if (preferGszzl) {
            rate = Number(fund.gszzl);
          } else {
            const zzl = fund.zzl !== undefined ? Number(fund.zzl) : Number.NaN;
            rate = Number.isFinite(zzl) ? zzl : Number(fund.gszzl);
          }
          if (!Number.isFinite(rate)) rate = 0;
          profitToday = amount - (amount / (1 + rate / 100));
        }
      } else {
        profitToday = null;
      }
    } else {
      // 使用估值
      currentNav = fund.estPricedCoverage > 0.05
        ? fund.estGsz
        : (isNumber(fund.gsz) ? fund.gsz : Number(fund.dwjz));

      if (!currentNav) return null;

      if (canCalcTodayProfit) {
        const amount = shareForTodayProfit * currentNav;
        const gzChange = fund.estPricedCoverage > 0.05 ? fund.estGszzl : (Number(fund.gszzl) || 0);
        profitToday = amount - (amount / (1 + gzChange / 100));
      } else {
        profitToday = null;
      }
    }

    // 持仓金额
    const amount = holding.share * currentNav;

    // 总收益 = (当前净值 - 成本价) * 份额
    const profitTotal = isNumber(holding.cost)
      ? (currentNav - holding.cost) * holding.share
      : null;

    return {
      amount,
      profitToday,
      profitTotal,
      principalToday: isNumber(holding.cost) ? holding.cost * shareForTodayProfit : 0,
      currentNav,
      shareForTodayProfit,
    };
  }, [isTradingDay, todayStr, transactions, activeGroupId]);

  /**
   * 计算持仓成本
   */
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

  /**
   * 计算收益率
   */
  const getYieldValue = useCallback((fund, holding) => {
    if (!fund || !holding) return null;
    const profit = getHoldingProfit(fund, holding);
    if (!profit || !profit.amount || !profit.profitTotal) return null;
    const cost = profit.amount - profit.profitTotal;
    if (cost <= 0) return null;
    return (profit.profitTotal / cost) * 100;
  }, [getHoldingProfit]);

  /**
   * 计算估算收益值
   */
  const getEstimateProfitValue = useCallback((fund, holding) => {
    if (!fund || !holding) return null;
    const profit = getHoldingProfit(fund, holding);
    if (!profit) return null;
    return profit.profitTotal;
  }, [getHoldingProfit]);

  /**
   * 获取昨日收益
   */
  const getYesterdayProfit = useCallback((code, jzrq, fundDailyEarnings) => {
    if (!code) return null;

    // 从日收益记录中查找
    if (fundDailyEarnings && isPlainObject(fundDailyEarnings)) {
      const earnings = fundDailyEarnings[code];
      if (earnings && isNumber(Number(earnings))) {
        return Number(earnings);
      }
    }

    return null;
  }, []);

  /**
   * 计算有持仓的分组
   */
  const groupsWithHoldings = useMemo(() => {
    const fundByCode = new Map((funds || []).map((f) => [f.code, f]));
    return (groups || []).filter((g) => {
      if (!g?.id || !Array.isArray(g.codes)) return false;
      const bucket = groupHoldings[g.id] || {};
      return g.codes.some((code) => {
        const fund = fundByCode.get(code);
        const h = bucket[code];
        if (!fund || !h) return false;
        const p = getHoldingProfit(fund, h, g.id);
        return p && Number.isFinite(p.amount) && p.amount > 0;
      });
    });
  }, [groups, groupHoldings, funds, getHoldingProfit]);

  /**
   * 汇总持仓统计（全部+分组）
   */
  const summaryTabPortfolioTotals = useMemo(() => {
    const fundByCode = new Map((funds || []).map((f) => [f.code, f]));
    let totalAsset = 0;
    let totalProfitToday = 0;
    let totalHoldingReturn = 0;
    let totalCost = 0;
    let totalPrincipalToday = 0;
    let hasHolding = false;
    let hasAnyTodayData = false;

    const accumulate = (fund, holding, scopeGid) => {
      if (!fund || !holding) return;
      const p = getHoldingProfit(fund, holding, scopeGid);
      if (!p || !Number.isFinite(p.amount) || p.amount <= 0) return;
      hasHolding = true;
      totalAsset += Math.round(p.amount * 100) / 100;
      if (p.profitToday != null) {
        totalProfitToday += p.profitToday;
        totalPrincipalToday += (p.principalToday || 0);
        hasAnyTodayData = true;
      }
      if (p.profitTotal != null) {
        totalHoldingReturn += p.profitTotal;
        if (typeof holding.cost === 'number' && typeof holding.share === 'number') {
          totalCost += holding.cost * holding.share;
        }
      }
    };

    // 全局持仓
    Object.entries(holdings || {}).forEach(([code, h]) => {
      accumulate(fundByCode.get(code), h, null);
    });

    // 分组持仓
    (groups || []).forEach((g) => {
      if (!g?.id) return;
      const bucket = groupHoldings[g.id] || {};
      Object.entries(bucket).forEach(([code, h]) => {
        accumulate(fundByCode.get(code), h, g.id);
      });
    });

    const roundedTotalProfitToday = Math.round(totalProfitToday * 100) / 100;
    const returnRate = totalCost > 0 ? (totalHoldingReturn / totalCost) * 100 : 0;
    const todayReturnRate = totalPrincipalToday > 0 ? (roundedTotalProfitToday / totalPrincipalToday) * 100 : 0;

    return {
      totalAsset,
      totalProfitToday: roundedTotalProfitToday,
      totalHoldingReturn,
      hasHolding,
      returnRate,
      todayReturnRate,
      hasAnyTodayData,
      totalCost,
    };
  }, [funds, holdings, groupHoldings, groups, getHoldingProfit]);

  /**
   * 检查是否有全局持仓
   */
  const hasGlobalPortfolioForSummary = useMemo(() => {
    const fundByCode = new Map((funds || []).map((f) => [f.code, f]));
    return Object.entries(holdings || {}).some(([code, h]) => {
      const fund = fundByCode.get(code);
      if (!fund || !h) return false;
      const p = getHoldingProfit(fund, h, null);
      return p && Number.isFinite(p.amount) && p.amount > 0;
    });
  }, [funds, holdings, getHoldingProfit]);

  /**
   * 合并持仓数据（用于汇总视图）
   */
  const { summaryMergedHoldings, summaryHoldingSourceGroupByCode } = useMemo(() => {
    const fundByCode = new Map((funds || []).map((f) => [f.code, f]));
    const merged = {};
    const sourceByCode = {};
    const codes = new Set();

    // 全局持仓
    Object.entries(holdings || {}).forEach(([code, h]) => {
      const fund = fundByCode.get(code);
      if (!fund || !h) return;
      const p = getHoldingProfit(fund, h, null);
      if (!p || !Number.isFinite(p.amount) || p.amount <= 0) return;
      codes.add(code);
      merged[code] = { ...h };
      sourceByCode[code] = { type: 'global' };
    });

    // 分组持仓
    (groups || []).forEach((g) => {
      if (!g?.id) return;
      const bucket = groupHoldings[g.id] || {};
      Object.entries(bucket).forEach(([code, h]) => {
        const fund = fundByCode.get(code);
        if (!fund || !h) return;
        const p = getHoldingProfit(fund, h, g.id);
        if (!p || !Number.isFinite(p.amount) || p.amount <= 0) return;
        codes.add(code);
        if (merged[code]) {
          // 已存在，合并份额
          merged[code].share = (merged[code].share || 0) + (h.share || 0);
          if (!sourceByCode[code].groups) {
            sourceByCode[code].groups = [];
          }
          sourceByCode[code].groups.push(g.id);
          sourceByCode[code].type = 'mixed';
        } else {
          merged[code] = { ...h };
          sourceByCode[code] = { type: 'group', groupId: g.id };
        }
      });
    });

    return { summaryMergedHoldings: merged, summaryHoldingSourceGroupByCode: sourceByCode };
  }, [funds, holdings, groupHoldings, groups, getHoldingProfit]);

  /**
   * 获取指定分组下某只基金的持仓
   */
  const getScopedHolding = useCallback((code, groupId, fallbackToGlobal = true) => {
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
      return holdings?.[code] || null;
    }

    return null;
  }, [holdings, groupHoldings]);

  /**
   * 获取分组下的基金列表
   */
  const getGroupFunds = useCallback((groupId) => {
    const group = groups?.find((g) => g.id === groupId);
    if (!group?.codes) return [];
    return (funds || []).filter((f) => group.codes.includes(f.code));
  }, [groups, funds]);

  return {
    // 基础计算
    getHoldingProfit,
    getCost,
    getYieldValue,
    getEstimateProfitValue,
    getYesterdayProfit,

    // 分组相关
    groupsWithHoldings,
    getScopedHolding,
    getGroupFunds,

    // 汇总统计
    summaryTabPortfolioTotals,
    hasGlobalPortfolioForSummary,
    summaryMergedHoldings,
    summaryHoldingSourceGroupByCode,
  };
}

/**
 * 深拷贝持仓对象
 */
export function cloneHoldingDeep(holding) {
  if (!holding || !isPlainObject(holding)) return holding;
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(holding)
      : JSON.parse(JSON.stringify(holding));
  } catch {
    return { ...holding };
  }
}

/**
 * 标准化持仓条目
 */
export function normalizeHoldingEntryForSeed(value) {
  if (!isPlainObject(value)) return null;
  const parsedShare = isNumber(value.share)
    ? value.share
    : isString(value.share)
    ? Number(value.share)
    : NaN;
  const parsedCost = isNumber(value.cost)
    ? value.cost
    : isString(value.cost)
    ? Number(value.cost)
    : NaN;
  const nextShare = Number.isFinite(parsedShare) ? parsedShare : null;
  const nextCost = Number.isFinite(parsedCost) ? parsedCost : null;
  if (nextShare === null && nextCost === null) return null;
  return { ...value, share: nextShare, cost: nextCost };
}

/**
 * 从全局持仓初始化分组持仓
 */
export function seedGroupHoldingsFromGlobal(globalHoldings, groups, prevGroupHoldings) {
  const prev = isPlainObject(prevGroupHoldings) ? prevGroupHoldings : {};
  const groupIdSet = new Set(groups.map((g) => g?.id).filter(Boolean));
  const next = {};
  for (const id of groupIdSet) {
    next[id] = { ...(isPlainObject(prev[id]) ? prev[id] : {}) };
  }

  let changed = Object.keys(prev).some((id) => !groupIdSet.has(id));
  if (!changed && Object.keys(next).length !== Object.keys(prev).filter((id) => groupIdSet.has(id)).length) {
    changed = true;
  }

  if (isPlainObject(globalHoldings)) {
    for (const g of groups) {
      if (!g?.id || !groupIdSet.has(g.id)) continue;
      const bucket = next[g.id];
      for (const code of g.codes || []) {
        if (!code || bucket[code] !== undefined) continue;
        const norm = normalizeHoldingEntryForSeed(globalHoldings[code]);
        if (!norm) continue;
        const cloned = cloneHoldingDeep(norm);
        if (cloned) {
          bucket[code] = cloned;
          changed = true;
        }
      }
    }
  }

  return changed ? next : prev;
}

/**
 * 检查对象是否有指定属性
 */
export function hasOwn(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
