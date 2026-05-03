"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { buildLLMPrompt } from "../lib/portfolioAnalysis";
import { CloseIcon } from "./Icons";

/**
 * 持仓分析弹窗
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object} props.analysis - usePortfolioAnalysis 返回的分析结果
 */
export default function PortfolioAnalysisModal({ open, onClose, analysis }) {
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // 弹框打开时触发 AI 分析
  useEffect(() => {
    if (!open || !analysis) return;
    setAiReport(null);
    setAiLoading(true);
    setAiError(null);

    const prompt = buildLLMPrompt(analysis);

    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '请求失败' }));
          throw new Error(err.error || err.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setAiReport(data.content);
        setAiLoading(false);
      })
      .catch((e) => {
        setAiError(e.message);
        setAiLoading(false);
      });
  }, [open]);

  if (!analysis) return null;

  const { riskScore, topOverlaps, sectorDistribution, issues, suggestions } = analysis;

  const riskColor =
    riskScore.level === 'high'
      ? 'var(--negative)'
      : riskScore.level === 'medium'
        ? 'orange'
        : 'var(--positive)';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-w-2xl" aria-describedby="portfolio-analysis-desc">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 分析图标 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                <polyline points="7.5 19.79 7.5 14.6 3 12" />
                <polyline points="21 12 16.5 14.6 16.5 19.79" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              持仓分析
            </span>
          </DialogTitle>
          <DialogClose className="icon-button border-none bg-transparent p-1">
            <CloseIcon width="18" height="18" />
          </DialogClose>
        </DialogHeader>

        <div id="portfolio-analysis-desc" className="sr-only">
          持仓分析报告，包含 AI 智能分析、风险评分、行业分布、持仓重合度和改进建议。
        </div>

        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* ─── AI 智能分析 ─── */}
          <section style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              AI 分析报告
            </h3>
            <div
              className="glass"
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {aiLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted-foreground)' }}>
                  <div style={{ fontSize: 14, marginBottom: 8 }}>AI 正在分析您的持仓...</div>
                  <div style={{ fontSize: 12 }}>预计 5-15 秒</div>
                </div>
              ) : aiError ? (
                <div style={{ color: 'var(--negative)', fontSize: 12 }}>
                  AI 分析失败：{aiError}
                  <br />
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    本地分析结果见下方。请检查 .env.local 中 MIMO_API_KEY 是否正确配置。
                  </span>
                </div>
              ) : aiReport ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{aiReport}</div>
              ) : (
                <div style={{ color: 'var(--muted-foreground)' }}>AI 分析尚未生成...</div>
              )}
            </div>
          </section>

          {/* ─── 风险评分 ─── */}
          <section style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              风险评分
            </h3>
            <div
              className="glass"
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {/* 总分圆环 */}
              <div style={{ position: 'relative', width: 72, height: 72 }}>
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="none"
                    stroke={riskColor}
                    strokeWidth="6"
                    strokeDasharray={`${(riskScore.total / 100) * 188.5} ${188.5}`}
                    strokeLinecap="round"
                    transform="rotate(-90 36 36)"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: riskColor,
                  }}
                >
                  {riskScore.total}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  风险等级：
                  <span style={{ fontWeight: 600, color: riskColor }}>
                    {riskScore.level === 'high' ? '高风险' : riskScore.level === 'medium' ? '中等风险' : '低风险'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
                  <span>集中度 {riskScore.concentration}</span>
                  <span>行业 {riskScore.sectorRisk}</span>
                  <span>重合 {riskScore.overlapRisk}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ─── 行业分布 ─── */}
          {sectorDistribution.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                行业分布
              </h3>
              <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
                {sectorDistribution.map((s) => (
                  <div
                    key={s.sector}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ minWidth: 60, fontSize: 13 }}>{s.sector}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        backgroundColor: 'rgba(128,128,128,0.15)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(s.weight, 100)}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                        }}
                      />
                    </div>
                    <span style={{ minWidth: 50, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                      {s.weight}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── 持仓重合 ─── */}
          {topOverlaps.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                持仓重合 Top {topOverlaps.length}
              </h3>
              <div className="glass" style={{ padding: 12, borderRadius: 10 }}>
                {topOverlaps.map((o, idx) => (
                  <div
                    key={`${o.fundA}-${o.fundB}-${idx}`}
                    style={{
                      padding: '8px 0',
                      borderBottom: idx < topOverlaps.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{o.fundAName}</span>
                      <span className="muted">↔</span>
                      <span>{o.fundBName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      重合 {o.overlapCount} 只股票，重合权重 {o.overlapWeight}%
                    </div>
                    {o.stocks.length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
                        共同持仓：{o.stocks.slice(0, 3).map((s) => s.name).join('、')}
                        {o.stocks.length > 3 ? ` 等${o.stocks.length}只` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── 发现的问题 ─── */}
          {issues.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                发现的问题 ({issues.length})
              </h3>
              {issues.map((issue, idx) => {
                const severityColor =
                  issue.severity === 'high'
                    ? 'var(--negative)'
                    : issue.severity === 'medium'
                      ? 'orange'
                      : 'var(--muted-foreground)';
                return (
                  <div
                    key={idx}
                    className="glass"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeft: `3px solid ${severityColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: severityColor,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: `${severityColor}20`,
                        }}
                      >
                        {issue.severity === 'high' ? '严重' : issue.severity === 'medium' ? '中等' : '轻微'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{issue.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {issue.description}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* ─── 改进建议 ─── */}
          {suggestions.length > 0 && (
            <section>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                改进建议
              </h3>
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="glass"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    marginBottom: 8,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--primary)',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    →
                  </span>
                  <span style={{ fontSize: 13 }}>{s.text}</span>
                </div>
              ))}
            </section>
          )}

          {/* ─── 空状态 ─── */}
          {issues.length === 0 && suggestions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--positive)' }}>
              <span style={{ fontSize: 16 }}>✓ 持仓状况良好，暂无发现问题</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
