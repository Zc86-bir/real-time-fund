import { useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { isNumber, isString, isPlainObject } from 'lodash';
import { TZ } from '../lib/fundHelpers';

/**
 * 格式化净值显示
 */
function formatNav(value) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toFixed(4);
}

/**
 * 格式化涨跌幅显示
 */
function formatChangePercent(value, muted = false) {
  if (muted) return '—';
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * 格式化金额显示
 */
function formatAmount(value, fallback = '-') {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 格式化收益显示（带正负号）
 */
function formatProfit(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return `${sign}${Math.abs(num).toFixed(2)}`;
}

/**
 * 格式化收益率显示
 */
function formatProfitPercent(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * 获取添加以来的涨跌幅
 */
function getSinceAddedChange(fund) {
  const addBaseNavRaw = fund.addBaseNav != null && fund.addBaseNav !== '' ? Number(fund.addBaseNav) : null;
  const addBaseNav = addBaseNavRaw != null && Number.isFinite(addBaseNavRaw) && addBaseNavRaw > 0 ? addBaseNavRaw : null;

  const sinceAddedCurrentNav = (() => {
    if (fund.noValuation) {
      const v = Number(fund.dwjz);
      return Number.isFinite(v) && v > 0 ? v : null;
    }
    if (fund.estPricedCoverage > 0.05) {
      const v = Number(fund.estGsz);
      return Number.isFinite(v) && v > 0 ? v : null;
    }
    const v = Number(fund.gsz);
    return Number.isFinite(v) && v > 0 ? v : null;
  })();

  const sinceAddedChangeValue = addBaseNav != null && sinceAddedCurrentNav != null
    ? ((sinceAddedCurrentNav / addBaseNav) - 1) * 100
    : null;

  return sinceAddedChangeValue;
}

/**
 * 格式化添加日期（省略当年份）
 */
function formatAddedDate(dateStr, todayStr) {
  if (!dateStr) return '';
  const currentYear = todayStr?.slice(0, 4);
  if (currentYear && dateStr.startsWith(`${currentYear}-`) && dateStr.length >= 10) {
    return dateStr.slice(5);
  }
  return dateStr;
}

/**
 * 管理 PC 端基金表格数据转换
 * @param {Object} options - 配置选项
 */
export function useTableData(options = {}) {
  const {
    displayFunds = [],
    holdings = {},
    fundDailyEarnings = {},
    fundTagListsByCode = {},
    transactions = {},
    dcaPlansForTab = {},
    currentTab = 'all',
    summaryHoldingSourceGroupByCode = {},
    linkedHoldingsForAllFav = { linked: new Set(), groupIdsByCode: {} },
    todayStr = '',
    isTradingDay = true,
    getHoldingProfitForTab,
    normalizeFundTagTheme,
    DAILY_EARNINGS_SCOPE_ALL,
    SUMMARY_TAB_ID,
    SUMMARY_SOURCE_GLOBAL,
  } = options;

  // 计算最新日收益数据
  const latestDailyByCode = useMemo(() => {
    const out = {};
    if (!isPlainObject(fundDailyEarnings)) return out;

    for (const f of displayFunds) {
      const code = f?.code;
      if (!code) continue;

      const list = fundDailyEarnings[code];
      if (!Array.isArray(list) || list.length === 0) continue;

      const byDate = new Map();
      for (const item of list) {
        const date = item?.date ? String(item.date) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        byDate.set(date, item);
      }

      out[code] = { byDate, last: list[list.length - 1] };
    }

    return out;
  }, [fundDailyEarnings, displayFunds]);

  // PC 端表格数据转换
  const tableData = useMemo(() => {
    return displayFunds.map((f) => {
      const hasTodayData = f.jzrq === todayStr;

      // 净值相关
      const latestNav = formatNav(f.dwjz);
      const estimateNav = f.noValuation
        ? '—'
        : formatNav(f.estPricedCoverage > 0.05 ? f.estGsz : f.gsz);

      // 昨日涨幅
      const yesterdayChangePercent = formatChangePercent(f.zzl);
      const yesterdayChangeValue = isNumber(f.zzl) ? Number(f.zzl) : null;
      const yesterdayDate = f.jzrq || '-';

      // 估算涨幅
      const estimateChangeValue = f.noValuation
        ? null
        : (f.estPricedCoverage > 0.05
          ? (isNumber(f.estGszzl) ? Number(f.estGszzl) : null)
          : (isNumber(f.gszzl) ? Number(f.gszzl) : null));

      const estimateChangePercent = f.noValuation
        ? '—'
        : formatChangePercent(estimateChangeValue);

      const estimateTime = f.noValuation ? (f.jzrq || '-') : (f.gztime || f.time || '-');
      const hasTodayEstimate = !f.noValuation && isString(f.gztime) && f.gztime.startsWith(todayStr);

      // 持仓相关
      const holding = holdings[f.code];
      const isHoldingLinked = linkedHoldingsForAllFav.linked?.has?.(f.code);
      const profit = getHoldingProfitForTab ? getHoldingProfitForTab(f, holding) : null;

      const amount = profit ? profit.amount : null;
      const holdingAmount = formatAmount(amount, '未设置');
      const holdingAmountValue = amount;

      const holdingDaysValue = holding?.firstPurchaseDate
        ? dayjs.tz(todayStr, TZ).diff(dayjs.tz(holding.firstPurchaseDate, TZ), 'day')
        : null;

      // 当日收益
      const profitToday = profit ? profit.profitToday : null;
      const todayProfit = formatProfit(profitToday);
      const todayProfitValue = profitToday;

      // 持仓成本
      const principal = holding && isNumber(holding.cost) && isNumber(holding.share)
        ? holding.cost * holding.share
        : 0;

      const holdingCostValue = holding && isNumber(holding.cost) && isNumber(holding.share)
        ? holding.cost * holding.share
        : null;

      const holdingCost = holdingCostValue == null
        ? '-'
        : Number(holdingCostValue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const costNavValue = holding && isNumber(holding.cost) ? holding.cost : null;
      const costNav = costNavValue == null ? '—' : Number(costNavValue).toFixed(4);

      const todayProfitPercent = profitToday != null && profit?.principalToday > 0
        ? `${profitToday > 0 ? '+' : profitToday < 0 ? '-' : ''}${Math.abs((profitToday / profit.principalToday) * 100).toFixed(2)}%`
        : '';

      // 昨日收益
      const latestNavDateStr = isString(f.jzrq) ? f.jzrq : '';
      const dailyMeta = latestDailyByCode?.[f.code];
      const matchedDaily =
        (latestNavDateStr ? (dailyMeta?.byDate?.get(latestNavDateStr) || null) : null)
        || dailyMeta?.last
        || null;

      const yesterdayProfitVal = matchedDaily && Number.isFinite(Number(matchedDaily.earnings))
        ? Number(matchedDaily.earnings)
        : null;

      const yesterdayProfit = formatProfit(yesterdayProfitVal);

      const dailyBaseCostAmount = matchedDaily && matchedDaily.baseCostAmount != null && matchedDaily.baseCostAmount !== '' && Number.isFinite(Number(matchedDaily.baseCostAmount))
        ? Number(matchedDaily.baseCostAmount)
        : null;

      const derivedRateFromSnapshot = yesterdayProfitVal != null && dailyBaseCostAmount != null && dailyBaseCostAmount > 0
        ? (yesterdayProfitVal / dailyBaseCostAmount) * 100
        : null;

      const dailyRate = matchedDaily && matchedDaily.rate != null && matchedDaily.rate !== '' && Number.isFinite(Number(matchedDaily.rate))
        ? Number(matchedDaily.rate)
        : derivedRateFromSnapshot;

      const yesterdayProfitPercent = dailyRate != null
        ? formatChangePercent(dailyRate)
        : (yesterdayProfitVal != null && principal > 0
          ? formatChangePercent((yesterdayProfitVal / principal) * 100)
          : '');

      const yesterdaySecondLinePctValue = dailyRate != null
        ? dailyRate
        : (yesterdayProfitVal != null && principal > 0
          ? (yesterdayProfitVal / principal) * 100
          : null);

      // 持有收益
      const profitTotal = profit ? profit.profitTotal : null;
      const holdingProfit = formatProfit(profitTotal);
      const holdingProfitPercent = profitTotal != null && principal > 0
        ? formatProfitPercent((profitTotal / principal) * 100)
        : '';
      const holdingProfitValue = profitTotal;
      const holdingProfitPercentValue = profitTotal != null && principal > 0 ? (profitTotal / principal) * 100 : null;

      // 估算收益
      const hasEstimatePercent = hasTodayEstimate && estimateChangeValue != null;
      const hasHoldingPercent = holdingProfitPercentValue != null;
      const fallbackEstimateProfitPercentValue = hasEstimatePercent || hasHoldingPercent
        ? (hasEstimatePercent ? estimateChangeValue : 0) + (hasHoldingPercent ? holdingProfitPercentValue : 0)
        : null;

      const estimateProfitPercentValue = hasTodayData
        ? holdingProfitPercentValue
        : fallbackEstimateProfitPercentValue;

      const estimateProfitValue = hasTodayData
        ? profitTotal
        : (estimateProfitPercentValue != null && principal > 0
          ? principal * (estimateProfitPercentValue / 100)
          : null);

      const estimateProfit = formatProfit(estimateProfitValue);
      const estimateProfitPercent = formatProfitPercent(estimateProfitPercentValue);

      // 添加以来涨跌幅
      const sinceAddedChangeValue = getSinceAddedChange(f);
      const sinceAddedChangePercent = sinceAddedChangeValue == null
        ? '—'
        : formatChangePercent(sinceAddedChangeValue);

      const sinceAddedDateRaw = (() => {
        const raw = f.addBaseDate;
        const rawStr = raw != null ? String(raw) : '';
        if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) return rawStr.slice(0, 10);
        const ts = Number(f.addedAt);
        if (Number.isFinite(ts) && ts > 0) return dayjs.tz(ts, TZ).format('YYYY-MM-DD');
        return '';
      })();

      const sinceAddedDate = formatAddedDate(sinceAddedDateRaw, todayStr);

      // 标签
      const fc = String(f.code ?? '').trim();
      const listFromDerived = fundTagListsByCode[fc];
      const fundTags = Array.isArray(listFromDerived)
        ? listFromDerived.map(({ name, theme }) => ({
            name: String(name ?? '').trim(),
            theme: normalizeFundTagTheme ? normalizeFundTagTheme(theme) : theme,
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

        // 净值
        latestNav,
        latestNavDate: yesterdayDate,
        estimateNav,
        estimateNavDate: estimateTime,

        // 涨跌幅
        yesterdayChangePercent,
        yesterdayChangeValue,
        yesterdayDate,
        estimateChangePercent,
        estimateChangeValue,
        estimateChangeMuted: f.noValuation,
        estimateTime,
        hasTodayEstimate,

        // 持有收益
        totalChangePercent: estimateProfitPercent,
        estimateProfit,
        estimateProfitValue,
        estimateProfitPercent,
        sinceAddedChangePercent,
        sinceAddedChangeValue,
        sinceAddedDate,
        sinceAddedDateRaw: sinceAddedDateRaw || undefined,

        // 持仓
        holdingAmount,
        holdingAmountValue,
        holdingCost,
        holdingCostValue,
        costNav,
        costNavValue,
        holdingDaysValue,

        // 当日收益
        todayProfit,
        todayProfitPercent,
        todayProfitValue,

        // 昨日收益
        yesterdayProfit,
        yesterdayProfitValue: yesterdayProfitVal,
        yesterdayProfitPercent,
        yesterdaySecondLinePctValue,

        // 持有收益
        holdingProfit,
        holdingProfitPercent,
        holdingProfitValue,

        // 分组来源
        holdingTargetGroupId: currentTab === SUMMARY_TAB_ID ? summaryHoldingSourceGroupByCode[f.code] : undefined,
      };
    });
  }, [
    displayFunds,
    holdings,
    fundDailyEarnings,
    fundTagListsByCode,
    transactions,
    dcaPlansForTab,
    currentTab,
    SUMMARY_TAB_ID,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    todayStr,
    isTradingDay,
    getHoldingProfitForTab,
    normalizeFundTagTheme,
    latestDailyByCode,
  ]);

  // 获取单个基金的表格数据（用于详情弹窗等）
  const getFundTableData = useCallback((fund) => {
    const index = tableData.findIndex(d => d.code === fund?.code);
    return index >= 0 ? tableData[index] : null;
  }, [tableData]);

  return {
    tableData,
    latestDailyByCode,
    getFundTableData,
  };
}

// 默认导出
export default useTableData;
