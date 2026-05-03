/**
 * 持仓分析引擎 — 本地纯计算版
 *
 * 分析维度：
 * 1. 持仓重合度：多只基金的前十大重仓股交集
 * 2. 行业/板块分布：按基金关联板块聚合持仓权重
 * 3. 风险集中度：单只基金权重、行业集中度评分
 * 4. 持仓风格：大盘/小盘、成长/价值、国内/海外配置
 * 5. 改进建议：基于上述分析生成模板化建议
 *
 * LLM 扩展接口：定义 `LLMProvider` 接口，后续可接入小米 MIMO v2.5
 */

// ─────────────────────────────────────────────────────────────────────
// 类型定义（JSDoc）
// ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FundInfo
 * @property {string} code - 基金代码
 * @property {string} name - 基金名称
 * @property {Array<{code: string, name: string, weight: number}>} holdings - 前十大重仓股
 * @property {string} [relatedSector] - 关联板块/行业
 * @property {number} [userWeight] - 用户在总资产中的权重（0-1）
 * @property {boolean} [holdingsIsLastQuarter] - 持仓数据是否为最新季度
 */

/**
 * @typedef {Object} OverlapPair
 * @property {string} fundA - 基金A代码
 * @property {string} fundB - 基金B代码
 * @property {string} fundAName - 基金A名称
 * @property {string} fundBName - 基金B名称
 * @property {number} overlapCount - 重合股票数量
 * @property {number} overlapWeight - 重合股票总权重
 * @property {Array<{code: string, name: string, weightA: number, weightB: number}>} stocks - 重合股票列表
 */

/**
 * @typedef {Object} SectorDistribution
 * @property {string} sector - 板块/行业名称
 * @property {number} weight - 板块总权重（按用户持仓加权）
 * @property {number} fundCount - 涉及基金数量
 * @property {Array<string>} fundCodes - 涉及基金代码
 */

/**
 * @typedef {Object} RiskScore
 * @property {number} total - 总风险评分（0-100，越低越安全）
 * @property {number} concentration - 集中度风险（单只基金占比过高）
 * @property {number} sectorRisk - 行业集中风险
 * @property {number} overlapRisk - 持仓重合风险
 * @property {string} level - 'low' | 'medium' | 'high'
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {RiskScore} riskScore
 * @property {Array<OverlapPair>} topOverlaps - 重合度最高的基金对（top 5）
 * @property {Array<SectorDistribution>} sectorDistribution - 行业分布
 * @property {Array<AnalysisIssue>} issues - 发现的问题
 * @property {Array<AnalysisSuggestion>} suggestions - 改进建议
 */

/**
 * @typedef {Object} AnalysisIssue
 * @property {string} type - 'concentration' | 'overlap' | 'sector' | 'stale'
 * @property {string} severity - 'high' | 'medium' | 'low'
 * @property {string} title - 问题标题
 * @property {string} description - 详细描述
 */

/**
 * @typedef {Object} AnalysisSuggestion
 * @property {string} type - 'reduce' | 'diversify' | 'rebalance' | 'update'
 * @property {string} text - 建议内容
 */

// ─────────────────────────────────────────────────────────────────────
// 分析函数
// ─────────────────────────────────────────────────────────────────────

/**
 * 计算两只基金之间的持仓重合度
 */
function computeOverlap(fundA, fundB) {
  if (!fundA.holdings?.length || !fundB.holdings?.length) return null;

  const stockMapA = new Map(fundA.holdings.map((s) => [s.code, s]));
  const overlapping = [];
  let totalOverlapWeight = 0;

  for (const stock of fundB.holdings) {
    if (stockMapA.has(stock.code)) {
      const weightA = stockMapA.get(stock.code).weight || 0;
      overlapping.push({
        code: stock.code,
        name: stock.name,
        weightA,
        weightB: stock.weight || 0,
      });
      totalOverlapWeight += Math.max(weightA, stock.weight || 0);
    }
  }

  if (overlapping.length === 0) return null;

  return {
    fundA: fundA.code,
    fundB: fundB.code,
    fundAName: fundA.name,
    fundBName: fundB.name,
    overlapCount: overlapping.length,
    overlapWeight: Math.round(totalOverlapWeight * 100) / 100,
    stocks: overlapping,
  };
}

/**
 * 计算所有基金对之间的持仓重合度，返回 top N
 */
function computeAllOverlaps(funds, topN = 5) {
  const overlaps = [];
  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const overlap = computeOverlap(funds[i], funds[j]);
      if (overlap) overlaps.push(overlap);
    }
  }
  return overlaps
    .sort((a, b) => b.overlapWeight - a.overlapWeight)
    .slice(0, topN);
}

/**
 * 按关联板块聚合行业分布
 */
function computeSectorDistribution(funds) {
  const sectorMap = new Map();

  for (const fund of funds) {
    const sector = fund.relatedSector || '未分类';
    const userWeight = fund.userWeight || (1 / funds.length);

    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        sector,
        weight: 0,
        fundCount: 0,
        fundCodes: [],
      });
    }

    const entry = sectorMap.get(sector);
    entry.weight += userWeight * 100;
    if (!entry.fundCodes.includes(fund.code)) {
      entry.fundCount++;
      entry.fundCodes.push(fund.code);
    }
  }

  return Array.from(sectorMap.values())
    .sort((a, b) => b.weight - a.weight)
    .map((s) => ({
      ...s,
      weight: Math.round(s.weight * 100) / 100,
    }));
}

/**
 * 计算风险评分
 */
function computeRiskScore(funds, overlaps, sectors) {
  let concentration = 0;
  let sectorRisk = 0;
  let overlapRisk = 0;

  // 集中度：最大单只基金权重
  const maxWeight = Math.max(...funds.map((f) => f.userWeight || 0));
  if (maxWeight > 0.5) concentration = 80;
  else if (maxWeight > 0.3) concentration = 50;
  else if (maxWeight > 0.2) concentration = 30;
  else concentration = 10;

  // 行业集中：最大行业占比
  const maxSectorWeight = Math.max(...sectors.map((s) => s.weight), 0);
  if (maxSectorWeight > 60) sectorRisk = 80;
  else if (maxSectorWeight > 40) sectorRisk = 50;
  else if (maxSectorWeight > 25) sectorRisk = 30;
  else sectorRisk = 10;

  // 持仓重合：最高重合度基金对的权重
  const maxOverlapWeight = overlaps.length > 0 ? overlaps[0].overlapWeight : 0;
  if (maxOverlapWeight > 20) overlapRisk = 80;
  else if (maxOverlapWeight > 10) overlapRisk = 50;
  else if (maxOverlapWeight > 5) overlapRisk = 30;
  else overlapRisk = 10;

  const total = Math.round(concentration * 0.3 + sectorRisk * 0.4 + overlapRisk * 0.3);
  const level = total > 60 ? 'high' : total > 30 ? 'medium' : 'low';

  return { total, concentration, sectorRisk, overlapRisk, level };
}

/**
 * 生成问题列表
 */
function generateIssues(funds, overlaps, sectors, riskScore) {
  const issues = [];

  // 检查单只基金集中度过高
  const maxWeightFund = funds.reduce(
    (max, f) => ((f.userWeight || 0) > (max.userWeight || 0) ? f : max),
    funds[0],
  );
  if (maxWeightFund && maxWeightFund.userWeight > 0.3) {
    issues.push({
      type: 'concentration',
      severity: 'high',
      title: `${maxWeightFund.name} 持仓占比过高`,
      description: `${maxWeightFund.name} 占总资产的 ${Math.round(maxWeightFund.userWeight * 100)}%，建议降低至 20% 以下以分散风险`,
    });
  }

  // 检查行业集中
  const maxSector = sectors[0];
  if (maxSector && maxSector.weight > 40) {
    issues.push({
      type: 'sector',
      severity: maxSector.weight > 60 ? 'high' : 'medium',
      title: `行业过度集中于「${maxSector.sector}」`,
      description: `${maxSector.sector}板块占比 ${maxSector.weight}%，建议配置不超过 40%`,
    });
  }

  // 检查持仓重合
  for (const overlap of overlaps.slice(0, 3)) {
    if (overlap.overlapWeight > 10) {
      issues.push({
        type: 'overlap',
        severity: overlap.overlapWeight > 20 ? 'high' : 'medium',
        title: `${overlap.fundAName} 与 ${overlap.fundBName} 持仓高度重合`,
        description: `两只基金共同持有 ${overlap.overlapCount} 只重仓股，重合权重 ${overlap.overlapWeight}%，建议保留其中一只即可`,
      });
    }
  }

  // 检查持仓数据时效
  const staleFunds = funds.filter((f) => !f.holdingsIsLastQuarter && f.holdings?.length > 0);
  if (staleFunds.length > 0) {
    issues.push({
      type: 'stale',
      severity: staleFunds.length > 2 ? 'medium' : 'low',
      title: `${staleFunds.length} 只基金持仓数据非最新季度`,
      description: `以下基金持仓数据可能已过时：${staleFunds.map((f) => f.name).join('、')}`,
    });
  }

  return issues;
}

/**
 * 生成改进建议
 */
function generateSuggestions(funds, overlaps, sectors, issues) {
  const suggestions = [];

  // 基于问题生成建议
  for (const issue of issues) {
    if (issue.type === 'concentration') {
      suggestions.push({
        type: 'reduce',
        text: issue.description,
      });
    } else if (issue.type === 'sector') {
      suggestions.push({
        type: 'diversify',
        text: `考虑增加其他行业配置，降低对「${issue.title.match(/「(.+?)」/)?.[1] || '当前行业'}」的依赖`,
      });
    } else if (issue.type === 'overlap') {
      suggestions.push({
        type: 'reduce',
        text: issue.description,
      });
    }
  }

  // 通用建议
  if (funds.length < 3) {
    suggestions.push({
      type: 'diversify',
      text: `当前仅持有 ${funds.length} 只基金，建议配置 3-5 只不同行业的基金以分散风险`,
    });
  }

  if (funds.length >= 8) {
    suggestions.push({
      type: 'rebalance',
      text: `持有 ${funds.length} 只基金数量较多，管理成本高，建议精简至 5-8 只核心基金`,
    });
  }

  return suggestions;
}

/**
 * 执行完整持仓分析
 * @param {Array<FundInfo>} funds - 持仓基金列表
 * @returns {AnalysisResult}
 */
export function analyzePortfolio(funds) {
  if (!funds || funds.length === 0) {
    return {
      riskScore: { total: 0, concentration: 0, sectorRisk: 0, overlapRisk: 0, level: 'low' },
      topOverlaps: [],
      sectorDistribution: [],
      issues: [],
      suggestions: [],
    };
  }

  const overlaps = computeAllOverlaps(funds);
  const sectors = computeSectorDistribution(funds);
  const riskScore = computeRiskScore(funds, overlaps, sectors);
  const issues = generateIssues(funds, overlaps, sectors, riskScore);
  const suggestions = generateSuggestions(funds, overlaps, sectors, issues);

  return { riskScore, topOverlaps: overlaps, sectorDistribution: sectors, issues, suggestions };
}

// ─────────────────────────────────────────────────────────────────────
// LLM Provider 接口定义 — 为后续接入小米 MIMO v2.5 预留
// ─────────────────────────────────────────────────────────────────────

/**
 * LLM 提供者接口
 *
 * 各 LLM 供应商实现此接口即可接入持仓智能分析。
 *
 * @typedef {Object} LLMProvider
 * @property {string} name - 提供者名称，如 'mimo' | 'claude' | 'deepseek'
 * @property {(prompt: string, options?: LLMOptions) => Promise<string>} generate - 生成文本
 */

/**
 * @typedef {Object} LLMOptions
 * @property {number} [maxTokens=2000]
 * @property {number} [temperature=0.7]
 * @property {string} [systemPrompt] - 系统提示词
 */

/**
 * 生成 LLM 分析提示词（与具体 LLM 无关）
 * @param {AnalysisResult} localResult - 本地计算结果
 * @returns {string}
 */
export function buildLLMPrompt(localResult) {
  const { riskScore, topOverlaps, sectorDistribution, issues, suggestions } = localResult;

  return `你是一位专业的基金投资顾问。请基于以下持仓分析结果，给出一份简洁易懂的投资建议报告。

## 风险评分
- 总分：${riskScore.total}/100（${riskScore.level === 'low' ? '低风险' : riskScore.level === 'medium' ? '中等风险' : '高风险'}）
- 集中度风险：${riskScore.concentration}/100
- 行业集中风险：${riskScore.sectorRisk}/100
- 持仓重合风险：${riskScore.overlapRisk}/100

## 行业分布
${sectorDistribution.map((s) => `- ${s.sector}：${s.weight}%（${s.fundCount} 只基金）`).join('\n')}

## 持仓重合 Top ${topOverlaps.length}
${topOverlaps.map((o) => `- ${o.fundAName} ↔ ${o.fundBName}：重合 ${o.overlapCount} 只股票，重合权重 ${o.overlapWeight}%`).join('\n')}

## 发现的问题
${issues.map((i) => `- [${i.severity === 'high' ? '严重' : i.severity === 'medium' ? '中等' : '轻微'}] ${i.title}: ${i.description}`).join('\n')}

## 本地建议
${suggestions.map((s) => `- ${s.text}`).join('\n')}

请给出：
1. 整体持仓评价（2-3句话）
2. 主要风险点（最多3个）
3. 具体调整建议（按优先级排序）
4. 是否需要调仓的明确结论

要求：简洁、专业、用中文回答。`;
}

/**
 * 默认 LLM 提供者（本地版，无 LLM）
 * 当未配置外部 LLM 时，使用本地计算结果作为最终输出
 * @type {LLMProvider}
 */
export const localProvider = {
  name: 'local',
  generate: async (prompt) => prompt, // 不处理，直接返回原始提示词
};

/**
 * 创建小米 MIMO v2.5 LLM 提供者
 *
 * 使用方式：
 * ```js
 * const mimoProvider = createMimoProvider({
 *   apiKey: process.env.MIMO_API_KEY,
 *   model: 'mimo-v2.5',
 * });
 * ```
 *
 * @param {{ apiKey: string, model?: string, baseUrl?: string }} config
 * @returns {LLMProvider}
 */
export function createMimoProvider(config) {
  const { apiKey, model = 'mimo-v2.5', baseUrl = 'https://api.xiaomimimo.com/v1' } = config;

  return {
    name: 'mimo',
    generate: async (prompt, options = {}) => {
      const { maxTokens = 2000, temperature = 0.7, systemPrompt } = options;

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`MIMO API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    },
  };
}
