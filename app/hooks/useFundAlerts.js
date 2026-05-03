import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { storageStore } from '@/app/stores';

const STORAGE_KEY = 'fundAlerts';
const FIRED_KEY = 'fundAlertFired';

/**
 * 基金涨跌提醒 Hook
 *
 * 数据结构：
 * - alerts: { [code]: { threshold: number, direction: 'up' | 'down' | 'both', enabled: boolean } }
 * - firedToday: { [code]: { date: string, lastFiredType: 'up' | 'down' } }
 *
 * 规则：
 * - 每个交易日每种类型（涨/跌）只触发一次
 * - 使用浏览器 Notification API，不支持时回退到 console
 */
export function useFundAlerts(funds = []) {
  const prevGszzlRef = useRef(new Map());
  const alertsRef = useRef({});
  const firedRef = useRef({});
  const [alerts, setAlerts] = useState({});

  // 加载提醒设置
  const loadAlerts = useCallback(() => {
    const stored = storageStore.getItem(STORAGE_KEY, {});
    alertsRef.current = stored;
    setAlerts(stored);
    const fired = storageStore.getItem(FIRED_KEY, {});
    firedRef.current = fired;
  }, []);

  // 初始化
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 每日重置 fired 记录
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 检查并触发提醒
  const checkAndNotify = useCallback((fund) => {
    if (!fund?.code || !fund?.name) return;
    const gszzl = Number(fund.gszzl);
    if (!Number.isFinite(gszzl)) return;

    const alert = alertsRef.current[fund.code];
    if (!alert || !alert.enabled) return;

    const { threshold, direction } = alert;
    const absGszzl = Math.abs(gszzl);

    // 判断是否超过阈值
    let triggeredType = null;
    if (direction === 'up' && gszzl >= threshold) triggeredType = 'up';
    else if (direction === 'down' && gszzl <= -threshold) triggeredType = 'down';
    else if (direction === 'both' && absGszzl >= threshold) {
      triggeredType = gszzl > 0 ? 'up' : 'down';
    }

    if (!triggeredType) return;

    // 检查今天是否已触发过同类型提醒
    const firedToday = firedRef.current[fund.code];
    if (firedToday && firedToday.date === todayStr && firedToday.lastFiredType === triggeredType) {
      return;
    }

    // 避免重复触发（同一轮刷新内 gszzl 没变化就不重复）
    const prevGszzl = prevGszzlRef.current.get(fund.code);
    if (prevGszzl === gszzl) return;

    // 触发通知
    const directionText = triggeredType === 'up' ? '涨超' : '跌超';
    const title = `${fund.name} ${directionText}${threshold}%`;
    const body = `当前${triggeredType === 'up' ? '+' : ''}${gszzl.toFixed(2)}%`;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon-60.png',
          tag: `fund-${fund.code}-${triggeredType}-${todayStr}`,
        });
      } catch (e) {
        // Notification 构造失败，静默处理
      }
    }

    // 记录已触发
    firedRef.current[fund.code] = { date: todayStr, lastFiredType: triggeredType };
    storageStore.setItem(FIRED_KEY, JSON.stringify(firedRef.current));
    prevGszzlRef.current.set(fund.code, gszzl);
  }, [todayStr]);

  // 监听 funds 变化，检查提醒
  useEffect(() => {
    if (!funds.length) return;
    for (const fund of funds) {
      checkAndNotify(fund);
    }
  }, [funds, checkAndNotify]);

  // 设置提醒
  const setAlert = useCallback((code, config) => {
    const next = { ...alertsRef.current, [code]: config };
    alertsRef.current = next;
    setAlerts(next);
    storageStore.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // 删除提醒
  const removeAlert = useCallback((code) => {
    const next = { ...alertsRef.current };
    delete next[code];
    alertsRef.current = next;
    setAlerts(next);
    storageStore.setItem(STORAGE_KEY, JSON.stringify(next));
    // 同时清除 fired 记录
    const firedNext = { ...firedRef.current };
    delete firedNext[code];
    firedRef.current = firedNext;
    storageStore.setItem(FIRED_KEY, JSON.stringify(firedNext));
  }, []);

  // 请求通知权限
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  return {
    alerts,
    setAlert,
    removeAlert,
    requestPermission,
    notificationSupported: typeof window !== 'undefined' && 'Notification' in window,
    notificationPermission: typeof window !== 'undefined' && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  };
}
