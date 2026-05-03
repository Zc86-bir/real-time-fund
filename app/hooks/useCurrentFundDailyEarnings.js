'use client';

import { useMemo } from 'react';
import { isPlainObject } from 'lodash';
import { SUMMARY_TAB_ID, SUMMARY_SOURCE_GLOBAL } from './useHoldings';
import { DAILY_EARNINGS_SCOPE_ALL } from '../lib/dailyEarnings';

/**
 * 当前 tab 每日收益数据 Hook
 * 从 page.jsx 提取 currentFundDailyEarnings useMemo（约 109 行）
 *
 * @param {Object} options
 * @param {Object} options.fundDailyEarnings - 原始每日收益数据
 * @param {string} options.activeGroupId - 当前激活的分组 ID
 * @param {string} options.currentTab - 当前 tab
 * @param {Object} options.summaryHoldingSourceGroupByCode - 汇总来源映射
 * @param {Object} options.linkedHoldingsForAllFav - 关联持仓
 * @param {Object} options.groupHoldings - 分组持仓
 * @returns {Object} 当前 tab 的每日收益数据
 */
export function useCurrentFundDailyEarnings(options) {
  const {
    fundDailyEarnings,
    activeGroupId,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    groupHoldings,
  } = options;

  return useMemo(() => {
    if (!isPlainObject(fundDailyEarnings)) return {};

    const getScopeBucket = (scopeKey) => {
      const scoped = fundDailyEarnings[scopeKey];
      return isPlainObject(scoped) ? scoped : {};
    };

    if (activeGroupId) {
      return getScopeBucket(activeGroupId);
    }

    if (currentTab === SUMMARY_TAB_ID) {
      const out = {};
      Object.entries(summaryHoldingSourceGroupByCode || {}).forEach(([code, source]) => {
        const scopeKey = source === SUMMARY_SOURCE_GLOBAL ? DAILY_EARNINGS_SCOPE_ALL : source;
        const bucket = getScopeBucket(scopeKey);
        const list = bucket[code];
        if (Array.isArray(list) && list.length > 0) out[code] = list;
      });
      return out;
    }

    const globalBucket = getScopeBucket(DAILY_EARNINGS_SCOPE_ALL);

    if (currentTab !== 'all' && currentTab !== 'fav') {
      return globalBucket;
    }

    const linkedCodes = linkedHoldingsForAllFav?.linked;
    if (!(linkedCodes instanceof Set) || linkedCodes.size === 0) {
      return globalBucket;
    }

    const out = { ...globalBucket };
    const groupIdsByCode = linkedHoldingsForAllFav?.groupIdsByCode || {};

    for (const code of linkedCodes) {
      const groupIds = Array.isArray(groupIdsByCode[code]) ? groupIdsByCode[code] : [];
      if (groupIds.length === 0) continue;

      let fallbackPrincipalCurrent = 0;
      for (const gid of groupIds) {
        const h = groupHoldings?.[gid]?.[code];
        if (!h) continue;
        const share = Number(h.share);
        const cost = Number(h.cost);
        if (!Number.isFinite(share) || share <= 0) continue;
        if (!Number.isFinite(cost) || cost <= 0) continue;
        fallbackPrincipalCurrent += cost * share;
      }

      const byDate = new Map();
      for (const gid of groupIds) {
        const bucket = getScopeBucket(gid);
        const list = bucket[code];
        if (!Array.isArray(list) || list.length === 0) continue;

        for (const item of list) {
          const date = item?.date ? String(item.date) : '';
          const earnings = Number(item?.earnings);
          const rate = Number(item?.rate);
          const baseCostAmount = Number(item?.baseCostAmount);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          if (!Number.isFinite(earnings)) continue;
          const prev = byDate.get(date) || { earnings: 0, rowCount: 0, singleRate: null, rateCount: 0, baseCostAmount: 0 };
          prev.earnings += earnings;
          prev.rowCount += 1;
          if (Number.isFinite(rate)) {
            prev.rateCount += 1;
            if (prev.singleRate == null) prev.singleRate = rate;
          }
          if (Number.isFinite(baseCostAmount) && baseCostAmount > 0) {
            prev.baseCostAmount += baseCostAmount;
          }
          byDate.set(date, prev);
        }
      }

      if (byDate.size > 0) {
        out[code] = [...byDate.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, row]) => {
            const earnings = row.earnings;
            const baseCostAmount = Number.isFinite(row.baseCostAmount) && row.baseCostAmount > 0
              ? row.baseCostAmount
              : null;
            let rate = null;
            if (baseCostAmount != null) {
              rate = (earnings / baseCostAmount) * 100;
            } else if (row.rowCount === 1 && row.rateCount === 1 && Number.isFinite(row.singleRate)) {
              rate = row.singleRate;
            } else if (Number.isFinite(fallbackPrincipalCurrent) && fallbackPrincipalCurrent > 0) {
              rate = (earnings / fallbackPrincipalCurrent) * 100;
            }
            return { date, earnings, rate, baseCostAmount };
          });
      }
    }

    return out;
  }, [
    fundDailyEarnings,
    activeGroupId,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    groupHoldings,
  ]);
}
