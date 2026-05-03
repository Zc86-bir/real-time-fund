"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { fetchEtfHoldings, fetchEtfBasicInfo } from "@/app/api/fund";
import { getEtfSecid, getTargetEtf } from "@/app/data/etfFeederMap";
import { CloseIcon } from "./Icons";

const EyeIcon = ({ width = 18, height = 18, ...props }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * ETF持仓查看弹窗
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.fundCode - 场外基金代码
 * @param {string} props.fundName - 基金名称
 */
export default function EtfHoldingsModal({ open, onClose, fundCode, fundName }) {
  const [holdings, setHoldings] = useState([]);
  const [etfInfo, setEtfInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !fundCode) return;

    let cancelled = false;
    const targetEtf = getTargetEtf(fundCode);
    const secid = getEtfSecid(fundCode);
    if (!targetEtf || !secid) {
      setError("未找到对应的ETF信息");
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetchEtfHoldings(targetEtf.etfCode),
      fetchEtfBasicInfo(secid),
    ]).then(([holdingsData, etfBasicInfo]) => {
      if (cancelled) return;
      setLoading(false);
      if (!holdingsData) {
        setError("获取ETF持仓失败，请稍后重试");
        return;
      }
      setHoldings(holdingsData);
      setEtfInfo(etfBasicInfo);
    }).catch((e) => {
      if (cancelled) return;
      setLoading(false);
      setError(`获取ETF持仓出错: ${e.message}`);
    });

    return () => {
      cancelled = true;
    };
  }, [open, fundCode]);

  const targetEtf = getTargetEtf(fundCode);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-w-2xl" aria-describedby="etf-holdings-desc">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle className="flex items-center gap-2">
            <EyeIcon width="18" height="18" />
            <span>
              ETF持仓 - {fundName}
              {targetEtf && (
                <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                  ({targetEtf.name})
                </span>
              )}
            </span>
          </DialogTitle>
          <DialogClose className="icon-button border-none bg-transparent p-1">
            <CloseIcon width="18" height="18" />
          </DialogClose>
        </DialogHeader>

        {etfInfo && (
          <div
            className="glass"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              display: "flex",
              gap: 16,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <div>
              <span className="muted">ETF净值</span>
              <span style={{ marginLeft: 6, fontWeight: 600 }}>
                {etfInfo.price != null ? etfInfo.price.toFixed(4) : "--"}
              </span>
            </div>
            <div>
              <span className="muted">涨跌幅</span>
              <span
                style={{
                  marginLeft: 6,
                  fontWeight: 600,
                  color:
                    etfInfo.pct != null
                      ? etfInfo.pct > 0
                        ? "var(--positive)"
                        : etfInfo.pct < 0
                          ? "var(--negative)"
                          : "var(--text)"
                      : "var(--text)",
                }}
              >
                {etfInfo.pct != null ? `${etfInfo.pct.toFixed(2)}%` : "--"}
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div className="muted">正在加载ETF持仓数据...</div>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "30px 0",
              color: "var(--negative)",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && holdings.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div className="muted">暂无持仓数据</div>
          </div>
        )}

        {!loading && !error && holdings.length > 0 && (
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>股票代码</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>股票名称</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>持仓占比</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>持股数(万股)</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>持仓市值(万元)</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((item, idx) => (
                  <tr
                    key={item.code || idx}
                    style={{
                      borderBottom: "1px solid rgba(128,128,128,0.1)",
                    }}
                  >
                    <td style={{ padding: "8px 6px" }}>{item.code}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 600 }}>
                      {item.weight != null ? `${item.weight.toFixed(2)}%` : "--"}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>
                      {item.shares != null ? item.shares.toLocaleString() : "--"}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>
                      {item.marketValue != null ? item.marketValue.toLocaleString() : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
