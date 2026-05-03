'use client';

import { useRef, useState, useEffect } from 'react';
import { asyncPool } from '../lib/asyncHelper';
import { fetchFundPeriodReturns } from '../api/fund';

const SORT_PERIOD_KEYS = ['last1Week', 'last1Month', 'last3Months', 'last6Months', 'last1Year'];

/**
 * 区间收益数据获取 Hook
 * 从 page.jsx 提取 sortPeriodReturns useEffect（约 50 行）
 *
 * @param {Object} options
 * @param {string} options.sortBy - 当前排序字段
 * @param {Array} options.scopedFunds - 当前作用域基金列表
 * @returns {{ data: Object, needsSort: boolean }}
 */
export function useSortPeriodReturns(options) {
  const { sortBy, scopedFunds } = options;

  const [sortPeriodReturnsByCode, setSortPeriodReturnsByCode] = useState({});
  const sortPeriodReturnsCacheRef = useRef(new Map());
  const needsSortPeriodReturns = SORT_PERIOD_KEYS.includes(sortBy);

  useEffect(() => {
    if (!needsSortPeriodReturns) return;
    const codes = scopedFunds.map((f) => f.code);
    if (codes.length === 0) return;

    let cancelled = false;
    const missing = [];
    const cachedBatch = {};

    for (const code of codes) {
      if (!sortPeriodReturnsCacheRef.current.has(code)) {
        missing.push(code);
      } else {
        cachedBatch[code] = sortPeriodReturnsCacheRef.current.get(code);
      }
    }

    if (Object.keys(cachedBatch).length > 0) {
      setSortPeriodReturnsByCode((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [code, value] of Object.entries(cachedBatch)) {
          if (next[code] !== value) {
            next[code] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (missing.length === 0) return;

    (async () => {
      await asyncPool(4, missing, async (code) => {
        const value = await fetchFundPeriodReturns(code);
        sortPeriodReturnsCacheRef.current.set(code, value);
        if (cancelled) return;
        setSortPeriodReturnsByCode((prev) => {
          if (prev[code] === value) return prev;
          return { ...prev, [code]: value };
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [scopedFunds, needsSortPeriodReturns]);

  return { sortPeriodReturnsByCode, needsSortPeriodReturns };
}
