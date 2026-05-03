import { useState, useCallback, useRef, useMemo } from 'react';
import { isNumber, isString, isPlainObject } from 'lodash';
import dayjs from 'dayjs';
import { asyncPool } from '../lib/asyncHelper';
import { fetchFundData, fetchFundNetValueRange } from '../api/fund';
import { recordValuation } from '../lib/valuationTimeseries';
import { DAILY_EARNINGS_SCOPE_ALL } from '../lib/dailyEarnings';
import { TZ, nowInTz } from '../lib/fundHelpers';

// 并发限制
const DEFAULT_CONCURRENCY = 3;

/**
 * 管理基金数据刷新（完整版）
 * 包含：数据获取、估值记录、日收益计算
 * @param {Object} options - 配置选项
 */
export function useFundRefresh(options = {}) {
  const {
    // 数据依赖
    funds = [],
    holdings = {},
    groupHoldings = {},
    transactions = {},
    fundDailyEarnings = {},
    // 刷新配置
    refreshMs = 60000,
    concurrency = DEFAULT_CONCURRENCY,
    // 存储相关
    storageStore = null,
    // 回调函数
    onFundsUpdated,
    onValuationUpdated,
    onDailyEarningsUpdated,
    onRefreshStart,
    onRefreshComplete,
    onRefreshError,
    onProcessPendingQueue,
  } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshError, setRefreshError] = useState(null);
  const refreshingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const refreshCycleStartRef = useRef(Date.now());

  // 获取添加基准快照
  const getAddBaseSnapshotFromFund = useCallback((fund) => {
    const dwjz = Number(fund?.dwjz);
    if (Number.isFinite(dwjz) && dwjz > 0) {
      return { nav: dwjz, date: fund?.jzrq || null };
    }
    const gsz = Number(fund?.gsz);
    if (Number.isFinite(gsz) && gsz > 0) {
      return { nav: gsz, date: fund?.gztime || fund?.time || null };
    }
    return { nav: null, date: null };
  }, []);

  // 验证日期字符串
  const isValidDateStr = useCallback((s) => {
    return isString(s) && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }, []);

  // 日期加减辅助函数
  const addDays = useCallback((dateStr, days) => {
    return dayjs.tz(dateStr, TZ).add(days, 'day').format('YYYY-MM-DD');
  }, []);

  const subDays = useCallback((dateStr, days) => {
    return dayjs.tz(dateStr, TZ).subtract(days, 'day').format('YYYY-MM-DD');
  }, []);

  // 计算收益
  const calcEarningsFromNavs = useCallback((nav, prevNav, share) => {
    return (nav - prevNav) * share;
  }, []);

  // 从收益计算收益率
  const calcRateFromEarnings = useCallback((earnings, baseCostAmount) => {
    if (!Number.isFinite(earnings) || !Number.isFinite(baseCostAmount) || baseCostAmount <= 0) return null;
    return (earnings / baseCostAmount) * 100;
  }, []);

  // 从基金数据计算最新日收益
  const calcLatestDayFromFund = useCallback((u, share, baseCostAmount) => {
    const nav = Number(u?.dwjz);
    if (!Number.isFinite(nav) || nav <= 0) return null;
    const lastNav = u?.lastNav != null && u.lastNav !== '' ? Number(u.lastNav) : null;
    if (lastNav != null && Number.isFinite(lastNav) && lastNav > 0) {
      const earnings = calcEarningsFromNavs(nav, lastNav, share);
      return {
        earnings,
        rate: calcRateFromEarnings(earnings, baseCostAmount),
      };
    }
    const zzl = u?.zzl != null && u.zzl !== '' ? Number(u.zzl) : Number.NaN;
    if (Number.isFinite(zzl)) {
      const prev = nav / (1 + zzl / 100);
      if (Number.isFinite(prev) && prev > 0) {
        const earnings = calcEarningsFromNavs(nav, prev, share);
        return {
          earnings,
          rate: calcRateFromEarnings(earnings, baseCostAmount),
        };
      }
    }
    return null;
  }, [calcEarningsFromNavs, calcRateFromEarnings]);

  // 查找前一个交易日的净值
  const findPrevTradingNav = useCallback(async (code, dateStr, navCache, u) => {
    if (u && isValidDateStr(u.jzrq) && u.jzrq === dateStr) {
      const lastNav = u?.lastNav != null && u.lastNav !== '' ? Number(u.lastNav) : null;
      if (lastNav != null && Number.isFinite(lastNav) && lastNav > 0) return lastNav;
    }
    if (navCache && navCache.size) {
      let bestD = '';
      let bestNav = null;
      for (const d of navCache.keys()) {
        if (!isValidDateStr(d) || d >= dateStr) continue;
        const v = navCache.get(d);
        if (!Number.isFinite(v) || v <= 0) continue;
        if (!bestD || d > bestD) {
          bestD = d;
          bestNav = v;
        }
      }
      if (bestNav != null) return bestNav;
    }
    const end = subDays(dateStr, 1);
    const start = subDays(dateStr, 120);
    const rows = await fetchFundNetValueRange(code, start, end);
    for (const r of rows) {
      if (navCache) navCache.set(r.date, r.nav);
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].date < dateStr) {
        const v = rows[i].nav;
        if (Number.isFinite(v) && v > 0) return v;
      }
    }
    return null;
  }, [isValidDateStr, subDays]);

  // 刷新所有基金
  const refreshAll = useCallback(async (codes) => {
    // 【步骤 1】重入锁检查
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    // 【步骤 2】参数归一化
    const uniqueCodes = Array.from(new Set(codes));
    let cachedStoredFundCodes = new Set();
    let cachedStoredFundsByCode = new Map();

    if (storageStore) {
      try {
        const arr = storageStore.getItem('funds', []);
        if (Array.isArray(arr)) {
          cachedStoredFundCodes = new Set(arr.map((x) => x?.code).filter(Boolean));
          cachedStoredFundsByCode = new Map(arr.filter((x) => x?.code).map((x) => [x.code, x]));
        }
      } catch (e) {
        console.warn('读取缓存基金列表失败', e);
      }
    }

    const fundCodeStillInStorage = (code) => {
      if (!code) return false;
      return cachedStoredFundCodes.has(code);
    };

    const getStoredFundSnapshot = (code) => {
      if (!code) return null;
      return cachedStoredFundsByCode.get(code) || null;
    };

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    if (onRefreshStart) onRefreshStart();

    try {
      const updated = [];
      const dailyChanges = {};
      let earningsChanged = false;
      const nextValuationSeries = {};
      let valuationChanged = false;

      // 记录到变更对象
      const localRecordToChanges = (scope, code, earnings, dateStr, rate, baseCostAmount, force = false) => {
        if (!dailyChanges[scope]) dailyChanges[scope] = {};
        const list = dailyChanges[scope][code] ||
                     (fundDailyEarnings[scope] && Array.isArray(fundDailyEarnings[scope][code]) ? fundDailyEarnings[scope][code] : []);
        const existingIndex = list.findIndex(item => item.date === dateStr);
        const normalizedRate = isNumber(rate) && Number.isFinite(rate) ? rate : null;
        const normalizedBaseCostAmount = Number.isFinite(Number(baseCostAmount)) && Number(baseCostAmount) > 0
          ? Number(baseCostAmount)
          : null;
        const nextList = existingIndex >= 0
          ? list.map((item, i) => {
            if (i !== existingIndex) return item;
            const prevRate = Number(item?.rate);
            const prevBaseCostAmount = Number(item?.baseCostAmount);
            const shouldUpdateRate = force || !Number.isFinite(prevRate);
            const shouldUpdateBase = force || !(Number.isFinite(prevBaseCostAmount) && prevBaseCostAmount > 0);
            return {
              date: dateStr,
              earnings,
              rate: shouldUpdateRate ? normalizedRate : prevRate,
              baseCostAmount: shouldUpdateBase ? normalizedBaseCostAmount : prevBaseCostAmount,
            };
          })
          : [...list, { date: dateStr, earnings, rate: normalizedRate, baseCostAmount: normalizedBaseCostAmount }];
        nextList.sort((a, b) => a.date.localeCompare(b.date));
        dailyChanges[scope][code] = nextList;
        earningsChanged = true;
      };

      // 【步骤 3】核心流水线
      const total = uniqueCodes.length;
      let completed = 0;

      await asyncPool(concurrency, uniqueCodes, async (c) => {
        // 检查是否被取消
        if (abortControllerRef.current?.signal.aborted) return null;

        if (!fundCodeStillInStorage(c)) return;
        let data = null;
        try {
          data = await fetchFundData(c);
        } catch (e) {
          console.error(`刷新基金 ${c} 失败`, e);
          if (fundCodeStillInStorage(c) && storageStore) {
            try {
              const arr = storageStore.getItem('funds', []);
              data = arr.find((f) => f.code === c);
            } catch { }
          }
        }

        if (!data || !fundCodeStillInStorage(c)) return;

        // 如果估值接口本轮失败（回退到 fallback），且本地已有旧数据，则保留旧数据不覆盖
        if (data.valuationSource === 'fallback' && getStoredFundSnapshot(c)) return;

        updated.push(data);

        // 【步骤 3.2】估值时序记录
        if (data.code != null && !data.noValuation && Number.isFinite(Number(data.gsz))) {
          const value = Number(data.gsz);
          const gztime = data.gztime ?? null;
          const dateStr = (isString(gztime) && /^\d{4}-\d{2}-\d{2}/.test(gztime))
            ? gztime.slice(0, 10)
            : dayjs().tz(TZ).format('YYYY-MM-DD');
          const timeLabel = (isString(gztime) && gztime.length > 10)
            ? gztime.slice(11, 16)
            : dayjs().tz(TZ).format('HH:mm');

          const list = Array.isArray(nextValuationSeries[data.code]) ? nextValuationSeries[data.code] : [];
          const lastDate = list.length ? list[list.length - 1].date : '';

          if (dateStr > lastDate) {
            nextValuationSeries[data.code] = [{ time: timeLabel, value, date: dateStr }];
            valuationChanged = true;
          } else if (dateStr === lastDate) {
            if (!list.some(p => p.time === timeLabel)) {
              nextValuationSeries[data.code] = [...list, { time: timeLabel, value, date: dateStr }];
              valuationChanged = true;
            }
          }
        }

        // 【步骤 3.3】收益补齐逻辑
        try {
          const targetScopes = [];
          if (holdings[data.code] && isNumber(holdings[data.code].share) && holdings[data.code].share > 0) {
            targetScopes.push(DAILY_EARNINGS_SCOPE_ALL);
          }
          Object.keys(groupHoldings || {}).forEach(gid => {
            if (groupHoldings[gid]?.[data.code] && isNumber(groupHoldings[gid][data.code].share) && groupHoldings[gid][data.code].share > 0) {
              targetScopes.push(gid);
            }
          });

          if (targetScopes.length === 0) return;

          const latestNavDate = data.jzrq;
          if (!isValidDateStr(latestNavDate)) return;

          const navCache = new Map();

          for (const scope of targetScopes) {
            const h = scope === DAILY_EARNINGS_SCOPE_ALL ? holdings[data.code] : groupHoldings[scope][data.code];
            const existing = dailyChanges[scope]?.[data.code] ||
                             (fundDailyEarnings[scope] && Array.isArray(fundDailyEarnings[scope][data.code]) ? fundDailyEarnings[scope][data.code] : []);
            const lastRecordedDate = existing.length ? existing[existing.length - 1]?.date : null;

            const getEffectiveShare = (targetDate) => {
              let baseShare = h.share;
              const list = transactions[data.code] || [];
              for (const tx of list) {
                if (!tx || !tx.date || tx.date < targetDate) continue;
                const gid = tx.groupId || null;
                const txInScope = (scope === DAILY_EARNINGS_SCOPE_ALL) ? !gid : (gid === scope);
                if (!txInScope) continue;
                const s = Number(tx.share) || 0;
                if (tx.type === 'buy') baseShare -= s;
                else if (tx.type === 'sell') baseShare += s;
              }
              return Math.max(0, baseShare);
            };

            if (!existing.length) {
              const share = getEffectiveShare(latestNavDate);
              const unitCost = Number(h?.cost);
              const baseCostAmount = Number.isFinite(unitCost) && unitCost > 0 ? unitCost * share : null;
              if (share > 0) {
                const v = calcLatestDayFromFund(data, share, baseCostAmount);
                if (v && Number.isFinite(v.earnings) && fundCodeStillInStorage(data.code)) {
                  localRecordToChanges(scope, data.code, v.earnings, latestNavDate, v.rate, baseCostAmount, true);
                }
              }
              if (!(dailyChanges[scope] && dailyChanges[scope][data.code])) {
                try {
                  const nav = Number(data.dwjz);
                  if (Number.isFinite(nav) && nav > 0) {
                    navCache.set(latestNavDate, nav);
                    const prevNav = await findPrevTradingNav(data.code, latestNavDate, navCache, data);
                    const share = getEffectiveShare(latestNavDate);
                    if (fundCodeStillInStorage(data.code) && Number.isFinite(prevNav) && prevNav > 0 && share > 0) {
                      const earnings = calcEarningsFromNavs(nav, prevNav, share);
                      const unitCost = Number(h?.cost);
                      const baseCostAmount = Number.isFinite(unitCost) && unitCost > 0 ? unitCost * share : null;
                      const rate = calcRateFromEarnings(earnings, baseCostAmount);
                      if (Number.isFinite(earnings)) {
                        localRecordToChanges(scope, data.code, earnings, latestNavDate, rate, baseCostAmount, true);
                      }
                    }
                  }
                } catch { }
              }
            } else if (isValidDateStr(lastRecordedDate) && lastRecordedDate < latestNavDate) {
              const latestNav = Number(data.dwjz);
              if (Number.isFinite(latestNav) && latestNav > 0) navCache.set(latestNavDate, latestNav);

              const start = addDays(lastRecordedDate, 1);
              const navRows = await fetchFundNetValueRange(data.code, lastRecordedDate, latestNavDate);
              if (fundCodeStillInStorage(data.code)) {
                for (const r of navRows) navCache.set(r.date, r.nav);
                const firstIdx = navRows.findIndex((r) => r.date >= start);
                if (firstIdx !== -1) {
                  for (let j = firstIdx; j < navRows.length; j++) {
                    const prevNav = j > 0 ? navRows[j - 1].nav : await findPrevTradingNav(data.code, navRows[j].date, navCache, data);
                    if (!fundCodeStillInStorage(data.code)) break;
                    if (!Number.isFinite(prevNav) || prevNav <= 0) continue;
                    const nav = navRows[j].nav;
                    const cursor = navRows[j].date;
                    if (!Number.isFinite(nav) || nav <= 0) continue;
                    const share = getEffectiveShare(cursor);
                    if (share <= 0) continue;
                    const earnings = calcEarningsFromNavs(nav, prevNav, share);
                    const unitCost = Number(h?.cost);
                    const baseCostAmount = Number.isFinite(unitCost) && unitCost > 0 ? unitCost * share : null;
                    const rate = calcRateFromEarnings(earnings, baseCostAmount);
                    if (Number.isFinite(earnings)) {
                      localRecordToChanges(scope, data.code, earnings, cursor, rate, baseCostAmount, true);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`记录 ${data.code} 每日收益失败`, e);
        }

        // 更新进度
        completed++;
        setRefreshProgress((completed / total) * 100);

        return data;
      });

      // 【步骤 4】回调通知
      if (updated.length > 0) {
        // 合并添加时间等字段
        const mergedFunds = updated.map((data) => {
          const stored = getStoredFundSnapshot(data.code);
          const merged = { ...data };
          if (stored?.addedAt != null) merged.addedAt = stored.addedAt;
          if (stored?.addBaseNav != null) merged.addBaseNav = stored.addBaseNav;
          if (stored?.addBaseDate != null) merged.addBaseDate = stored.addBaseDate;
          if (merged.addedAt == null || merged.addBaseNav == null || merged.addBaseDate == null) {
            const snap = getAddBaseSnapshotFromFund(merged);
            if (merged.addedAt == null) merged.addedAt = Date.now();
            if (merged.addBaseNav == null && snap.nav != null) merged.addBaseNav = snap.nav;
            if (merged.addBaseDate == null && snap.date) merged.addBaseDate = snap.date;
          }
          return merged;
        });

        if (onFundsUpdated) {
          onFundsUpdated(mergedFunds, { valuationChanged, nextValuationSeries });
        }

        if (valuationChanged && storageStore) {
          storageStore.setItem('fundValuationTimeseries', JSON.stringify(nextValuationSeries));
        }
      }

      if (earningsChanged && onDailyEarningsUpdated) {
        // 清理已删除基金的收益记录
        for (const code of uniqueCodes) {
          if (!cachedStoredFundCodes.has(code)) {
            Object.keys(dailyChanges).forEach(s => {
              if (dailyChanges[s] && dailyChanges[s][code]) {
                delete dailyChanges[s][code];
              }
            });
          }
        }
        onDailyEarningsUpdated(dailyChanges);
      }

      if (onRefreshComplete) {
        onRefreshComplete({ updated, valuationChanged, earningsChanged });
      }

      return { updated, valuationChanged, earningsChanged };
    } catch (error) {
      setRefreshError(error.message);
      if (onRefreshError) onRefreshError(error);
      throw error;
    } finally {
      // 【步骤 5】后期调度
      refreshingRef.current = false;
      setIsRefreshing(false);
      refreshCycleStartRef.current = Date.now();

      // 设置下一次刷新
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (codes.length) refreshAll(codes);
      }, refreshMs);

      // 【步骤 6】队列处理
      if (onProcessPendingQueue) {
        try {
          await onProcessPendingQueue();
        } catch (e) {
          console.warn('待交易处理出错', e);
        }
      }
    }
  }, [
    holdings, groupHoldings, transactions, fundDailyEarnings,
    refreshMs, concurrency, storageStore,
    isValidDateStr, addDays,
    calcEarningsFromNavs, calcRateFromEarnings, calcLatestDayFromFund,
    findPrevTradingNav, getAddBaseSnapshotFromFund,
    onFundsUpdated, onDailyEarningsUpdated,
    onRefreshStart, onRefreshComplete, onRefreshError, onProcessPendingQueue,
  ]);

  // 取消刷新
  const cancelRefresh = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    refreshingRef.current = false;
    setIsRefreshing(false);
    setRefreshProgress(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 清理定时器
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    isRefreshing,
    refreshProgress,
    refreshError,
    refreshAll,
    cancelRefresh,
    cleanup,
    refreshingRef,
  };
}

/**
 * 管理搜索历史
 * @param {number} maxHistory - 最大历史记录数
 */
export function useSearchHistory(maxHistory = 10) {
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('fundSearchHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = useCallback((term) => {
    if (!term || typeof term !== 'string') return;

    const trimmed = term.trim();
    if (!trimmed) return;

    setSearchHistory((prev) => {
      // 去重并将最新搜索放到最前面
      const filtered = prev.filter((item) => item !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, maxHistory);

      // 保存到 localStorage
      localStorage.setItem('fundSearchHistory', JSON.stringify(updated));

      return updated;
    });
  }, [maxHistory]);

  const removeFromHistory = useCallback((term) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item !== term);
      localStorage.setItem('fundSearchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('fundSearchHistory');
  }, []);

  return {
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}

/**
 * 管理基金搜索（完整版）
 * @param {Object} options - 配置选项
 */
export function useFundSearch(options = {}) {
  const { onSearch, debounceMs = 300 } = options;

  const [searchTerm, setSearchTermState] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef(null);

  const performSearch = useCallback(async (term) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(term.trim())}`
      );
      const data = await response.json();

      if (!data || !data.Datas) {
        setSearchResults([]);
        return [];
      }

      const results = data.Datas.map((item) => ({
        code: item.CODE,
        name: item.NAME,
        type: item.FundBaseInfo?.FTYPE || '',
      })).slice(0, 10);

      setSearchResults(results);
      if (onSearch) onSearch(results);
      return results;
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  const setSearchTerm = useCallback((term) => {
    setSearchTermState(term);

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的定时器
    debounceTimerRef.current = setTimeout(() => {
      performSearch(term);
    }, debounceMs);
  }, [performSearch, debounceMs]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setSearchResults([]);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    searchTerm,
    searchResults,
    isSearching,
    setSearchTerm,
    clearSearch,
    performSearch,
  };
}
