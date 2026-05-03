import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useStorageStore } from '../stores';

/**
 * 管理自动刷新定时器
 * @param {number} refreshMs - 刷新间隔（毫秒）
 * @param {Function} onRefresh - 刷新回调函数
 * @param {boolean} enabled - 是否启用自动刷新
 */
export function useAutoRefresh(refreshMs, onRefresh, enabled = true) {
  const timerRef = useRef(null);
  const refreshCycleStartRef = useRef(null);
  const refreshingRef = useRef(false);

  const startRefreshCycle = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    refreshCycleStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!refreshingRef.current) {
        onRefresh();
      }
    }, refreshMs);
  }, [refreshMs, onRefresh]);

  const stopRefreshCycle = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRefreshCycle = useCallback(() => {
    stopRefreshCycle();
    if (enabled) {
      startRefreshCycle();
    }
  }, [enabled, startRefreshCycle, stopRefreshCycle]);

  // 组件挂载时启动，卸载时停止
  useEffect(() => {
    refreshCycleStartRef.current = Date.now();
    if (enabled) {
      startRefreshCycle();
    }
    return () => stopRefreshCycle();
  }, [enabled, startRefreshCycle, stopRefreshCycle]);

  return {
    timerRef,
    refreshCycleStartRef,
    refreshingRef,
    startRefreshCycle,
    stopRefreshCycle,
    resetRefreshCycle,
  };
}

/**
 * 管理响应式布局
 */
export function useResponsiveLayout() {
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    const updateWidth = () => {
      const main = document.querySelector('main');
      if (main) {
        setContainerWidth(main.clientWidth);
      }
    };

    checkMobile();
    updateWidth();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  return { containerWidth, isMobile };
}

/**
 * 管理模态框状态
 * @param {string} modalName - 模态框名称
 * @param {boolean} defaultOpen - 默认是否打开
 */
export function useModalState(modalName, defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}

/**
 * 管理多个模态框状态
 */
export function useModalsState(modalNames) {
  const [states, setStates] = useState(() => {
    const initial = {};
    modalNames.forEach((name) => {
      initial[name] = false;
    });
    return initial;
  });

  const open = useCallback((name) => {
    setStates((prev) => ({ ...prev, [name]: true }));
  }, []);

  const close = useCallback((name) => {
    setStates((prev) => ({ ...prev, [name]: false }));
  }, []);

  const toggle = useCallback((name) => {
    setStates((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const isOpen = useCallback(
    (name) => states[name] || false,
    [states]
  );

  return { states, open, close, toggle, isOpen };
}
