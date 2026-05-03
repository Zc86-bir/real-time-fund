'use client';

import { useMemo } from 'react';
import { isNumber, isPlainObject } from 'lodash';
import { SUMMARY_TAB_ID, SUMMARY_SOURCE_GLOBAL } from './useHoldings';
import { DAILY_EARNINGS_SCOPE_ALL, aggregatePortfolioDailyEarnings } from '../lib/dailyEarnings';

/**
 * 汇总卡片数据 Hook
 * 从 page.jsx 提取 summaryCardItems useMemo（约 150 行）
 *
 * @param {Object} options
 * @param {string} options.currentTab - 当前 tab
 * @param {boolean} options.hasGlobalPortfolioForSummary - 是否有全局持仓用于汇总
 * @param {Array} options.funds - 基金列表
 * @param {Object} options.holdings - 全局持仓
 * @param {Object} options.groupHoldings - 分组持仓
 * @param {Array} options.groupsWithHoldings - 有持仓的分组
 * @param {Function} options.getHoldingProfit - 持仓收益计算
 * @param {Object} options.fundDailyEarnings - 每日收益数据
 * @returns {Array} 汇总卡片列表
 */
export function useSummaryCards(options) {
  const {
    currentTab,
    hasGlobalPortfolioForSummary,
    funds,
    holdings,
    groupHoldings,
    groupsWithHoldings,
    getHoldingProfit,
    fundDailyEarnings,
  } = options;

  return useMemo(() => {
    if (currentTab !== SUMMARY_TAB_ID) return [];
    const items = [];

    if (hasGlobalPortfolioForSummary) {
      let totalAsset = 0;
      let totalHoldingReturn = 0;
      let totalCost = 0;
      let totalProfitToday = 0;
      let totalPrincipalToday = 0;
      let hasAnyTodayData = false;
      let upCount = 0;
      let downCount = 0;

      for (const fund of funds || []) {
        const holding = holdings[fund.code];
        if (!holding) continue;
        const profit = getHoldingProfit(fund, holding, null);
        if (!profit) continue;
        totalAsset += Math.round(profit.amount * 100) / 100;
        if (profit.profitToday != null) {
          totalProfitToday += profit.profitToday;
          totalPrincipalToday += (profit.principalToday || 0);
          hasAnyTodayData = true;
        }
        if (profit.profitTotal !== null) {
          totalHoldingReturn += profit.profitTotal;
          if (typeof holding.cost === 'number' && typeof holding.share === 'number') {
            totalCost += holding.cost * holding.share;
          }
        }
        const ev = fund.noValuation
          ? null
          : fund.estPricedCoverage > 0.05
            ? (isNumber(fund.estGszzl) ? Number(fund.estGszzl) : null)
            : (isNumber(fund.gszzl) ? Number(fund.gszzl) : null);
        if (ev != null && Number.isFinite(ev)) {
          if (ev > 0) upCount += 1;
          else if (ev < 0) downCount += 1;
        }
      }

      const roundedToday = Math.round(totalProfitToday * 100) / 100;
      const returnRate = totalCost > 0 ? (totalHoldingReturn / totalCost) * 100 : 0;
      const todayReturnRate = totalPrincipalToday > 0 ? (roundedToday / totalPrincipalToday) * 100 : 0;
      const scopeDaily = isPlainObject(fundDailyEarnings?.[DAILY_EARNINGS_SCOPE_ALL])
        ? fundDailyEarnings[DAILY_EARNINGS_SCOPE_ALL]
        : {};
      const dailySeries = aggregatePortfolioDailyEarnings(scopeDaily);
      let cum = 0;
      const sparkSeries = dailySeries.map((pt) => {
        cum += pt.earnings;
        return { date: pt.date, earnings: cum };
      });

      items.push({
        groupId: SUMMARY_SOURCE_GLOBAL,
        groupName: '全部',
        totalAsset,
        holdingReturn: totalHoldingReturn,
        holdingReturnPercent: returnRate,
        accountReturn: roundedToday,
        accountReturnPercent: todayReturnRate,
        hasAnyTodayData,
        upCount,
        downCount,
        sparkSeries,
      });
    }

    items.push(
      ...groupsWithHoldings.map((g) => {
        const bucket = groupHoldings[g.id] || {};
        const groupFunds = (funds || []).filter((f) => g.codes.includes(f.code));
        let totalAsset = 0;
        let totalHoldingReturn = 0;
        let totalCost = 0;
        let totalProfitToday = 0;
        let totalPrincipalToday = 0;
        let hasAnyTodayData = false;
        let upCount = 0;
        let downCount = 0;

        for (const fund of groupFunds) {
          const holding = bucket[fund.code];
          const profit = getHoldingProfit(fund, holding, g.id);
          if (profit) {
            totalAsset += Math.round(profit.amount * 100) / 100;
            if (profit.profitToday != null) {
              totalProfitToday += profit.profitToday;
              totalPrincipalToday += (profit.principalToday || 0);
              hasAnyTodayData = true;
            }
            if (profit.profitTotal !== null) {
              totalHoldingReturn += profit.profitTotal;
              if (holding && typeof holding.cost === 'number' && typeof holding.share === 'number') {
                totalCost += holding.cost * holding.share;
              }
            }
          }
          const ev = fund.noValuation
            ? null
            : fund.estPricedCoverage > 0.05
              ? (isNumber(fund.estGszzl) ? Number(fund.estGszzl) : null)
              : (isNumber(fund.gszzl) ? Number(fund.gszzl) : null);
          if (ev != null && Number.isFinite(ev)) {
            if (ev > 0) upCount += 1;
            else if (ev < 0) downCount += 1;
          }
        }

        const roundedToday = Math.round(totalProfitToday * 100) / 100;
        const returnRate = totalCost > 0 ? (totalHoldingReturn / totalCost) * 100 : 0;
        const todayReturnRate = totalPrincipalToday > 0 ? (roundedToday / totalPrincipalToday) * 100 : 0;

        const scopeDaily = isPlainObject(fundDailyEarnings?.[g.id]) ? fundDailyEarnings[g.id] : {};
        const dailySeries = aggregatePortfolioDailyEarnings(scopeDaily);
        let cum = 0;
        const sparkSeries = dailySeries.map((pt) => {
          cum += pt.earnings;
          return { date: pt.date, earnings: cum };
        });

        return {
          groupId: g.id,
          groupName: g.name || '分组',
          totalAsset,
          holdingReturn: totalHoldingReturn,
          holdingReturnPercent: returnRate,
          accountReturn: roundedToday,
          accountReturnPercent: todayReturnRate,
          hasAnyTodayData,
          upCount,
          downCount,
          sparkSeries,
        };
      })
    );
    return items;
  }, [
    currentTab,
    groupsWithHoldings,
    funds,
    groupHoldings,
    holdings,
    getHoldingProfit,
    fundDailyEarnings,
    hasGlobalPortfolioForSummary,
  ]);
}
