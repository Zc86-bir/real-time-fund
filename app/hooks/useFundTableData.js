'use client';

import { useMemo } from 'react';
import dayjs from 'dayjs';
import { isNumber, isString, isPlainObject } from 'lodash';
import { normalizeFundTagTheme } from './useFundTags';
import { SUMMARY_TAB_ID } from './useHoldings';

/**
 * 基金表格数据格式化 Hook
 * 从 page.jsx 提取 pcFundTableData useMemo（约 260 行）
 *
 * @param {Object} options
 * @param {Array} options.displayFunds - 排序后的基金列表
 * @param {string} options.todayStr - 今日日期字符串
 * @param {string} options.TZ - 时区名称
 * @param {Object} options.holdingsForTabWithLinked - 持仓数据
 * @param {Function} options.getHoldingProfitForTab - 持仓收益计算
 * @param {Object} options.dcaPlansForTab - 定投计划
 * @param {Object} options.latestDailyByCode - 每日收益映射
 * @param {string} options.currentTab - 当前 tab
 * @param {Object} options.summaryHoldingSourceGroupByCode - 汇总来源映射
 * @param {Object} options.linkedHoldingsForAllFav - 关联持仓
 * @param {Object} options.fundTagListsByCode - 标签映射
 * @param {boolean} options.isTradingDay - 是否交易日
 * @returns {Array} 格式化后的表格数据
 */
export function useFundTableData(options) {
  const {
    displayFunds,
    todayStr,
    TZ,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    dcaPlansForTab,
    latestDailyByCode,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    fundTagListsByCode,
  } = options;

  return useMemo(() => {
    return displayFunds.map((f) => {
      const hasTodayData = f.jzrq === todayStr;
      const latestNav = f.dwjz != null && f.dwjz !== ''
        ? (typeof f.dwjz === 'number' ? Number(f.dwjz).toFixed(4) : String(f.dwjz))
        : '—';
      const estimateNav = f.noValuation
        ? '—'
        : (f.estPricedCoverage > 0.05
          ? (f.estGsz != null ? Number(f.estGsz).toFixed(4) : '—')
          : (f.gsz != null ? (typeof f.gsz === 'number' ? Number(f.gsz).toFixed(4) : String(f.gsz)) : '—'));

      const yesterdayChangePercent =
        f.zzl != null && f.zzl !== ''
          ? `${f.zzl > 0 ? '+' : ''}${Number(f.zzl).toFixed(2)}%`
          : '—';
      const yesterdayChangeValue = f.zzl != null && f.zzl !== '' ? Number(f.zzl) : null;
      const yesterdayDate = f.jzrq || '-';

      const estimateChangePercent = f.noValuation
        ? '—'
        : (f.estPricedCoverage > 0.05
          ? (f.estGszzl != null
            ? `${f.estGszzl > 0 ? '+' : ''}${Number(f.estGszzl).toFixed(2)}%`
            : '—')
          : (isNumber(f.gszzl)
            ? `${f.gszzl > 0 ? '+' : ''}${Number(f.gszzl).toFixed(2)}%`
            : (f.gszzl ?? '—')));
      const estimateChangeValue = f.noValuation
        ? null
        : (f.estPricedCoverage > 0.05
          ? (isNumber(f.estGszzl) ? Number(f.estGszzl) : null)
          : (isNumber(f.gszzl) ? Number(f.gszzl) : null));
      const estimateTime = f.noValuation ? (f.jzrq || '-') : (f.gztime || f.time || '-');
      const hasTodayEstimate = !f.noValuation && isString(f.gztime) && f.gztime.startsWith(todayStr);

      const holding = holdingsForTabWithLinked[f.code];
      const isHoldingLinked =
        (currentTab === 'all' || currentTab === 'fav') &&
        linkedHoldingsForAllFav.linked?.has?.(f.code);
      const profit = getHoldingProfitForTab(f, holding);
      const amount = profit ? profit.amount : null;
      const holdingAmount =
        amount == null ? '未设置' : `¥${Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const holdingAmountValue = amount;
      const holdingDaysValue = holding?.firstPurchaseDate
        ? dayjs.tz(todayStr, TZ).diff(dayjs.tz(holding.firstPurchaseDate, TZ), 'day')
        : null;

      const profitToday = profit ? profit.profitToday : null;
      const todayProfit =
        profitToday == null
          ? ''
          : `${profitToday > 0 ? '+' : profitToday < 0 ? '-' : ''}${Math.abs(profitToday).toFixed(2)}`;
      const todayProfitValue = profitToday;

      const total = profit ? profit.profitTotal : null;
      const principal =
        holding && isNumber(holding.cost) && isNumber(holding.share)
          ? holding.cost * holding.share
          : 0;
      const holdingCostValue =
        holding && isNumber(holding.cost) && isNumber(holding.share)
          ? holding.cost * holding.share
          : null;
      const holdingCost =
        holdingCostValue == null
          ? '-'
          : Number(holdingCostValue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const costNavValue = holding && isNumber(holding.cost) ? holding.cost : null;
      const costNav = costNavValue == null ? '—' : Number(costNavValue).toFixed(4);
      const todayProfitPercent =
        profitToday != null && profit?.principalToday > 0
          ? `${profitToday > 0 ? '+' : profitToday < 0 ? '-' : ''}${Math.abs((profitToday / profit.principalToday) * 100).toFixed(2)}%`
          : '';

      const latestNavDateStr = isString(f.jzrq) ? f.jzrq : '';
      const dailyMeta = latestDailyByCode?.[f.code];
      const matchedDaily =
        (latestNavDateStr ? (dailyMeta?.byDate?.get(latestNavDateStr) || null) : null)
        || dailyMeta?.last
        || null;
      const yesterdayProfitVal =
        matchedDaily && Number.isFinite(Number(matchedDaily.earnings))
          ? Number(matchedDaily.earnings)
          : null;
      const yesterdayProfit =
        yesterdayProfitVal == null
          ? ''
          : `${yesterdayProfitVal > 0 ? '+' : yesterdayProfitVal < 0 ? '-' : ''}${Math.abs(yesterdayProfitVal).toFixed(2)}`;
      const dailyBaseCostAmount =
        matchedDaily && matchedDaily.baseCostAmount != null && matchedDaily.baseCostAmount !== '' && Number.isFinite(Number(matchedDaily.baseCostAmount))
          ? Number(matchedDaily.baseCostAmount)
          : null;
      const derivedRateFromSnapshot =
        yesterdayProfitVal != null && dailyBaseCostAmount != null && dailyBaseCostAmount > 0
          ? (yesterdayProfitVal / dailyBaseCostAmount) * 100
          : null;
      const dailyRate =
        matchedDaily && matchedDaily.rate != null && matchedDaily.rate !== '' && Number.isFinite(Number(matchedDaily.rate))
          ? Number(matchedDaily.rate)
          : derivedRateFromSnapshot;
      const yesterdayProfitPercentLine =
        dailyRate != null
          ? `${dailyRate > 0 ? '+' : dailyRate < 0 ? '-' : ''}${Math.abs(dailyRate).toFixed(2)}%`
          : (yesterdayProfitVal != null && principal > 0
            ? `${yesterdayProfitVal > 0 ? '+' : yesterdayProfitVal < 0 ? '-' : ''}${Math.abs((yesterdayProfitVal / principal) * 100).toFixed(2)}%`
            : '');
      const yesterdaySecondLinePctValue =
        dailyRate != null
          ? dailyRate
          : (yesterdayProfitVal != null && principal > 0
            ? (yesterdayProfitVal / principal) * 100
            : null);

      const holdingProfit =
        total == null ? '' : `${total > 0 ? '+' : total < 0 ? '-' : ''}${Math.abs(total).toFixed(2)}`;
      const holdingProfitPercent =
        total != null && principal > 0
          ? `${total > 0 ? '+' : total < 0 ? '-' : ''}${Math.abs((total / principal) * 100).toFixed(2)}%`
          : '';
      const holdingProfitValue = total;

      const holdingProfitPercentValue = total != null && principal > 0 ? (total / principal) * 100 : null;
      const hasEstimatePercent = hasTodayEstimate && estimateChangeValue != null;
      const hasHoldingPercent = holdingProfitPercentValue != null;
      const fallbackEstimateProfitPercentValue = hasEstimatePercent || hasHoldingPercent
        ? (hasEstimatePercent ? estimateChangeValue : 0) + (hasHoldingPercent ? holdingProfitPercentValue : 0)
        : null;
      const estimateProfitPercentValue = hasTodayData
        ? holdingProfitPercentValue
        : fallbackEstimateProfitPercentValue;
      const estimateProfitValue = hasTodayData
        ? total
        : (estimateProfitPercentValue != null && principal > 0
          ? principal * (estimateProfitPercentValue / 100)
          : null);
      const estimateProfit =
        estimateProfitValue == null
          ? ''
          : `${estimateProfitValue > 0 ? '+' : estimateProfitValue < 0 ? '-' : ''}${Math.abs(estimateProfitValue).toFixed(2)}`;
      const estimateProfitPercent =
        estimateProfitPercentValue == null
          ? ''
          : `${estimateProfitPercentValue > 0 ? '+' : ''}${estimateProfitPercentValue.toFixed(2)}%`;

      const addBaseNavRaw = f.addBaseNav != null && f.addBaseNav !== '' ? Number(f.addBaseNav) : null;
      const addBaseNav = addBaseNavRaw != null && Number.isFinite(addBaseNavRaw) && addBaseNavRaw > 0 ? addBaseNavRaw : null;
      const sinceAddedCurrentNav = (() => {
        if (f.noValuation) {
          const v = Number(f.dwjz);
          return Number.isFinite(v) && v > 0 ? v : null;
        }
        if (f.estPricedCoverage > 0.05) {
          const v = Number(f.estGsz);
          return Number.isFinite(v) && v > 0 ? v : null;
        }
        const v = Number(f.gsz);
        return Number.isFinite(v) && v > 0 ? v : null;
      })();
      const sinceAddedChangeValue =
        addBaseNav != null && sinceAddedCurrentNav != null
          ? ((sinceAddedCurrentNav / addBaseNav) - 1) * 100
          : null;
      const sinceAddedChangePercent =
        sinceAddedChangeValue == null
          ? '—'
          : `${sinceAddedChangeValue > 0 ? '+' : ''}${sinceAddedChangeValue.toFixed(2)}%`;
      const sinceAddedDateRaw = (() => {
        const raw = f.addBaseDate;
        const rawStr = raw != null ? String(raw) : '';
        if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) return rawStr.slice(0, 10);
        const ts = Number(f.addedAt);
        if (Number.isFinite(ts) && ts > 0) return dayjs.tz(ts, TZ).format('YYYY-MM-DD');
        return '';
      })();
      const sinceAddedDate = (() => {
        const raw = sinceAddedDateRaw || '';
        if (!raw) return '';
        const currentYear = typeof todayStr === 'string' && todayStr.length >= 4 ? todayStr.slice(0, 4) : '';
        if (currentYear && raw.startsWith(`${currentYear}-`) && raw.length >= 10) return raw.slice(5);
        return raw;
      })();

      const fc = String(f.code ?? '').trim();
      const listFromDerived = fundTagListsByCode[fc];
      const fundTags = Array.isArray(listFromDerived)
        ? listFromDerived.map(({ name, theme }) => ({
            name: String(name ?? '').trim(),
            theme: normalizeFundTagTheme(theme),
          }))
        : [];

      return {
        rawFund: f,
        code: f.code,
        fundName: f.name,
        fundTags,
        isHoldingLinked: !!isHoldingLinked,
        isUpdated: f.jzrq === todayStr,
        hasDca: dcaPlansForTab[f.code]?.enabled === true,
        latestNav,
        latestNavDate: yesterdayDate,
        estimateNav,
        estimateNavDate: estimateTime,
        yesterdayChangePercent,
        yesterdayChangeValue,
        yesterdayDate,
        estimateChangePercent,
        estimateChangeValue,
        estimateChangeMuted: f.noValuation,
        estimateTime,
        hasTodayEstimate,
        totalChangePercent: estimateProfitPercent,
        estimateProfit,
        estimateProfitValue,
        estimateProfitPercent,
        sinceAddedChangePercent,
        sinceAddedChangeValue,
        sinceAddedDate,
        sinceAddedDateRaw: sinceAddedDateRaw || undefined,
        holdingAmount,
        holdingAmountValue,
        holdingCost,
        holdingCostValue,
        costNav,
        costNavValue,
        holdingDaysValue,
        todayProfit,
        todayProfitPercent,
        todayProfitValue,
        yesterdayProfit,
        yesterdayProfitValue: yesterdayProfitVal,
        yesterdayProfitPercent: yesterdayProfitPercentLine,
        yesterdaySecondLinePctValue,
        holdingProfit,
        holdingProfitPercent,
        holdingProfitValue,
        holdingTargetGroupId:
          currentTab === SUMMARY_TAB_ID ? summaryHoldingSourceGroupByCode[f.code] : undefined,
      };
    });
  }, [
    displayFunds,
    todayStr,
    TZ,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    dcaPlansForTab,
    latestDailyByCode,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    fundTagListsByCode,
  ]);
}
