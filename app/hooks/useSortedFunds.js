'use client';

import { useMemo } from 'react';
import dayjs from 'dayjs';
import { isNumber, isString } from 'lodash';

/**
 * 基金排序与过滤 Hook
 * 从 page.jsx 提取 displayFunds useMemo（约 225 行）
 *
 * @param {Object} options
 * @param {Array} options.scopedFunds - 当前 tab 下的基金列表
 * @param {string} options.currentTab - 当前 tab
 * @param {Array} options.groups - 分组列表
 * @param {string} options.sortBy - 排序字段
 * @param {string} options.sortOrder - 'asc' | 'desc'
 * @param {Object} options.holdingsForTabWithLinked - 持仓数据
 * @param {Function} options.getHoldingProfitForTab - 持仓收益计算
 * @param {string} options.groupFundSearchTerm - 分组内搜索词
 * @param {boolean} options.shouldShowGroupFundSearch - 是否显示分组搜索
 * @param {Object} options.currentFundDailyEarnings - 每日收益数据
 * @param {Object} options.sortPeriodReturnsByCode - 区间收益数据
 * @param {string} options.todayStr - 今日日期字符串
 * @param {Object} options.fundTagListsByCode - 标签映射
 * @returns {Array} 排序后的基金列表
 */
export function useSortedFunds(options) {
  const {
    scopedFunds,
    currentTab,
    groups,
    sortBy,
    sortOrder,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    groupFundSearchTerm,
    shouldShowGroupFundSearch,
    currentFundDailyEarnings,
    sortPeriodReturnsByCode,
    todayStr,
    fundTagListsByCode,
  } = options;

  return useMemo(() => {
    let filtered = [...scopedFunds];

    // 分组内搜索过滤
    const q = (shouldShowGroupFundSearch ? (groupFundSearchTerm || '') : '').trim();
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter((f) => {
        const name = String(f?.name ?? '').toLowerCase();
        const code = String(f?.code ?? '').toLowerCase();
        return name.includes(qLower) || code.includes(qLower);
      });
    }

    // 自定义分组默认排序（按添加顺序）
    if (currentTab !== 'all' && currentTab !== 'fav' && currentTab !== '__portfolio_groups_summary__' && sortBy === 'default') {
      const group = groups.find((g) => g.id === currentTab);
      if (group && group.codes) {
        const codeMap = new Map(group.codes.map((code, index) => [code, index]));
        filtered.sort((a, b) => {
          const indexA = codeMap.get(a.code) ?? Number.MAX_SAFE_INTEGER;
          const indexB = codeMap.get(b.code) ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB;
        });
      }
    }

    // 预计算持仓收益（多排序字段共用）
    const profitByCode =
      sortBy === 'holdingAmount' || sortBy === 'todayProfit' || sortBy === 'holding'
        ? new Map(filtered.map((f) => [f.code, getHoldingProfitForTab(f, holdingsForTabWithLinked[f.code])]))
        : null;

    return filtered.sort((a, b) => {
      // 收益率排序
      if (sortBy === 'yield') {
        const getYieldValue = (fund) => {
          if (fund.noValuation) return { value: 0, hasValue: false };
          if (fund.estPricedCoverage > 0.05) {
            if (isNumber(fund.estGszzl)) return { value: fund.estGszzl, hasValue: true };
            return { value: 0, hasValue: false };
          }
          if (isNumber(fund.gszzl)) return { value: Number(fund.gszzl), hasValue: true };
          return { value: 0, hasValue: false };
        };
        const { value: valA, hasValue: hasA } = getYieldValue(a);
        const { value: valB, hasValue: hasB } = getYieldValue(b);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 持仓金额排序
      if (sortBy === 'holdingAmount') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const amountA = pa?.amount ?? Number.NEGATIVE_INFINITY;
        const amountB = pb?.amount ?? Number.NEGATIVE_INFINITY;
        return sortOrder === 'asc' ? amountA - amountB : amountB - amountA;
      }

      // 最新涨幅排序
      if (sortBy === 'yesterdayIncrease') {
        const valA = Number(a.zzl);
        const valB = Number(b.zzl);
        const hasA = Number.isFinite(valA);
        const hasB = Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 当日收益排序
      if (sortBy === 'todayProfit') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const valA = pa?.profitToday;
        const valB = pb?.profitToday;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 持有收益排序
      if (sortBy === 'holding') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const valA = pa?.profitTotal;
        const valB = pb?.profitTotal;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 估算收益排序
      if (sortBy === 'estimateProfit') {
        const getEstimateProfitValue = (f) => {
          const hasTodayData = f.jzrq === todayStr;
          const holding = holdingsForTabWithLinked[f.code];
          const profit = getHoldingProfitForTab(f, holding);
          const total = profit ? profit.profitTotal : null;
          if (hasTodayData) return total;
          const principal = holding && isNumber(holding.cost) && isNumber(holding.share) ? holding.cost * holding.share : 0;
          const hasTodayEstimate = !f.noValuation && isString(f.gztime) && f.gztime.startsWith(todayStr);
          const estimateChangeValue = f.noValuation ? null : (f.estPricedCoverage > 0.05 ? (isNumber(f.estGszzl) ? Number(f.estGszzl) : null) : (isNumber(f.gszzl) ? Number(f.gszzl) : null));
          const holdingProfitPercentValue = total != null && principal > 0 ? (total / principal) * 100 : null;
          const hasEstimatePercent = hasTodayEstimate && estimateChangeValue != null;
          const hasHoldingPercent = holdingProfitPercentValue != null;
          const fallback = hasEstimatePercent || hasHoldingPercent
            ? (hasEstimatePercent ? estimateChangeValue : 0) + (hasHoldingPercent ? holdingProfitPercentValue : 0)
            : null;
          return fallback != null && principal > 0 ? principal * (fallback / 100) : null;
        };
        const valA = getEstimateProfitValue(a);
        const valB = getEstimateProfitValue(b);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 昨日收益排序
      if (sortBy === 'yesterdayProfit') {
        const getYesterdayProfit = (code, jzrq) => {
          const list = currentFundDailyEarnings?.[code];
          if (!Array.isArray(list) || list.length === 0) return null;
          let matchedDaily = null;
          if (typeof jzrq === 'string') {
            for (const item of list) {
              if (item?.date === jzrq) { matchedDaily = item; break; }
            }
          }
          if (!matchedDaily) matchedDaily = list[list.length - 1];
          return matchedDaily && Number.isFinite(Number(matchedDaily.earnings)) ? Number(matchedDaily.earnings) : null;
        };
        const valA = getYesterdayProfit(a.code, a.jzrq);
        const valB = getYesterdayProfit(b.code, b.jzrq);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 持有天数排序
      if (sortBy === 'holdingDays') {
        const ha = holdingsForTabWithLinked[a.code];
        const hb = holdingsForTabWithLinked[b.code];
        const valA = ha?.firstPurchaseDate ? dayjs(todayStr).diff(dayjs(ha.firstPurchaseDate), 'day') : null;
        const valB = hb?.firstPurchaseDate ? dayjs(todayStr).diff(dayjs(hb.firstPurchaseDate), 'day') : null;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 持仓成本排序
      if (sortBy === 'holdingCost') {
        const getCost = (h) => h?.cost != null && h?.share != null && Number.isFinite(Number(h.cost)) && Number.isFinite(Number(h.share)) ? Number(h.cost) * Number(h.share) : null;
        const valA = getCost(holdingsForTabWithLinked[a.code]);
        const valB = getCost(holdingsForTabWithLinked[b.code]);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 区间收益排序
      if (['last1Week', 'last1Month', 'last3Months', 'last6Months', 'last1Year'].includes(sortBy)) {
        const keyMap = { last1Week: 'week', last1Month: 'month', last3Months: 'month3', last6Months: 'month6', last1Year: 'year1' };
        const key = keyMap[sortBy];
        const valA = sortPeriodReturnsByCode[a.code]?.[key];
        const valB = sortPeriodReturnsByCode[b.code]?.[key];
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // 标签排序
      if (sortBy === 'tags') {
        const getTagKey = (fund) => {
          const code = String(fund?.code ?? '').trim();
          const list = code ? fundTagListsByCode?.[code] : null;
          if (!Array.isArray(list) || list.length === 0) return '';
          return list.map((t) => (t?.name != null ? String(t.name).trim() : '')).filter(Boolean).join('、');
        };
        const keyA = getTagKey(a);
        const keyB = getTagKey(b);
        const hasA = !!keyA;
        const hasB = !!keyB;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? keyA.localeCompare(keyB, 'zh-CN') : keyB.localeCompare(keyA, 'zh-CN');
      }

      // 名称排序
      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name, 'zh-CN') : b.name.localeCompare(a.name, 'zh-CN');
      }

      // 默认不排序
      return 0;
    });
  }, [
    scopedFunds, currentTab, groups, sortBy, sortOrder,
    holdingsForTabWithLinked, getHoldingProfitForTab,
    groupFundSearchTerm, shouldShowGroupFundSearch,
    currentFundDailyEarnings, sortPeriodReturnsByCode,
    todayStr, fundTagListsByCode,
  ]);
}
