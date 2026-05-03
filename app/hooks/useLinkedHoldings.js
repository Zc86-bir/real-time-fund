'use client';

import { useMemo, useEffect } from 'react';
import { isNumber, isPlainObject } from 'lodash';
import { DAILY_EARNINGS_SCOPE_ALL } from '../lib/dailyEarnings';

/**
 * 关联持仓计算 Hook
 * 从 page.jsx 提取 linkedHoldingsForAllFav useMemo + 关联的 useEffect（约 70 行）
 *
 * 计算「全部」和「收藏」tab 下，基金在各分组中的持仓合并数据。
 * 同时清理全局收益中已由关联持仓覆盖的基金数据。
 *
 * @param {Object} options
 * @param {string} options.currentTab - 当前 tab
 * @param {string} options.activeGroupId - 当前激活分组 ID
 * @param {Array} options.funds - 基金列表
 * @param {Object} options.holdings - 全局持仓
 * @param {Object} options.groupHoldings - 分组持仓
 * @param {Array} options.groups - 分组列表
 * @param {Function} options.setFundDailyEarnings - 设置每日收益
 * @returns {Object} { derived, linked, groupIdsByCode }
 */
export function useLinkedHoldings(options) {
  const {
    currentTab,
    activeGroupId,
    funds,
    holdings,
    groupHoldings,
    groups,
    setFundDailyEarnings,
  } = options;

  const linkedHoldingsForAllFav = useMemo(() => {
    const enabled = (currentTab === 'all' || currentTab === 'fav') && !activeGroupId;
    if (!enabled) return { derived: {}, linked: new Set(), groupIdsByCode: {} };

    const derived = {};
    const linked = new Set();
    const groupIdsByCode = {};

    const hasGlobalHolding = (h) =>
      !!h && isNumber(h.share) && Number(h.share) > 0;

    for (const fund of funds || []) {
      const code = fund?.code;
      if (!code) continue;
      if (hasGlobalHolding(holdings?.[code])) continue;

      let totalShare = 0;
      let totalCostShare = 0;
      let hasAnyCost = false;
      const sourceGroupIds = [];

      for (const g of groups || []) {
        const gid = g?.id;
        if (!gid) continue;
        const h = groupHoldings?.[gid]?.[code];
        if (!h) continue;
        const s = Number(h.share);
        if (!Number.isFinite(s) || s <= 0) continue;
        sourceGroupIds.push(gid);
        totalShare += s;

        const c = h.cost == null || h.cost === '' ? null : Number(h.cost);
        if (c != null && Number.isFinite(c) && c > 0) {
          totalCostShare += c * s;
          hasAnyCost = true;
        }
      }

      if (totalShare > 0) {
        derived[code] = {
          share: totalShare,
          cost: hasAnyCost ? totalCostShare / totalShare : null,
        };
        linked.add(code);
        groupIdsByCode[code] = sourceGroupIds;
      }
    }

    return { derived, linked, groupIdsByCode };
  }, [currentTab, activeGroupId, funds, holdings, groupHoldings, groups]);

  // 清理全局收益中已由关联持仓覆盖的基金数据
  useEffect(() => {
    const linkedCodes = linkedHoldingsForAllFav?.linked;
    if (!(linkedCodes instanceof Set) || linkedCodes.size === 0) return;
    setFundDailyEarnings((prev) => {
      if (!isPlainObject(prev)) return prev;
      const globalBucket = prev[DAILY_EARNINGS_SCOPE_ALL];
      if (!isPlainObject(globalBucket)) return prev;
      const nextGlobalBucket = { ...globalBucket };
      let changed = false;
      for (const code of linkedCodes) {
        if (code in nextGlobalBucket) {
          delete nextGlobalBucket[code];
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, [DAILY_EARNINGS_SCOPE_ALL]: nextGlobalBucket };
    });
  }, [linkedHoldingsForAllFav, setFundDailyEarnings]);

  return linkedHoldingsForAllFav;
}
