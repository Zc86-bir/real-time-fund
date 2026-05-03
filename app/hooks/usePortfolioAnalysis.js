"use client";

import { useMemo } from "react";
import { analyzePortfolio } from "../lib/portfolioAnalysis";
import { getFundSector } from "../data/fundSectorMap";

/**
 * 持仓分析 Hook
 *
 * @param {Array} funds - 基金列表（从 page.jsx 传入）
 * @param {Object} [options]
 * @param {Object} [options.holdings] - 用户持仓数据 { [code]: { share, cost } }
 * @returns {{ riskScore, topOverlaps, sectorDistribution, issues, suggestions, isLoaded }}
 */
export default function usePortfolioAnalysis(funds, { holdings = {} } = {}) {
  return useMemo(() => {
    if (!funds || funds.length === 0) {
      return {
        riskScore: { total: 0, concentration: 0, sectorRisk: 0, overlapRisk: 0, level: 'low' },
        topOverlaps: [],
        sectorDistribution: [],
        issues: [],
        suggestions: [],
        isLoaded: false,
      };
    }

    // 计算总资产，用于分配用户权重
    const totalValue = Object.values(holdings).reduce((sum, h) => {
      if (!h || typeof h.share !== 'number' || typeof h.cost !== 'number') return sum;
      return sum + h.share * h.cost;
    }, 0);

    const fundInfos = funds.map((f) => {
      const holding = holdings[f.code];
      const rawValue = holding && typeof holding.share === 'number' && typeof holding.cost === 'number'
        ? holding.share * holding.cost
        : 0;
      const userWeight = totalValue > 0 ? rawValue / totalValue : 0;
      // 前端兜底：Supabase 无数据时用基金代码/名称推断板块
      const sector = f.relatedSector || getFundSector(f.code, f.name) || '';

      return {
        code: f.code,
        name: f.name,
        holdings: f.holdings || [],
        relatedSector: sector,
        userWeight,
        holdingsIsLastQuarter: f.holdingsIsLastQuarter || false,
      };
    });

    const result = analyzePortfolio(fundInfos);

    return {
      ...result,
      isLoaded: true,
    };
  }, [funds, holdings]);
}
