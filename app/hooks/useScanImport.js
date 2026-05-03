import { useState, useCallback, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { isPlainObject } from 'lodash';
import { asyncPool } from '../lib/asyncHelper';
import { fetchFundData, searchFunds, parseFundTextWithLLM } from '../api/fund';

// OCR Worker CDN 配置
const OCR_CONFIG = {
  cdnBases: [
    'https://01kjzb6fhx9f8rjstc8c21qadx.esa.staticdn.net/npm',
    'https://fastly.jsdelivr.net/npm',
    'https://cdn.jsdelivr.net/npm',
  ],
  coreCandidates: [
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-lstm.wasm.js',
  ],
  workerPath: (base) => `${base}/tesseract.js@v5.1.1/dist/worker.min.js`,
  corePath: (base, coreFile) => `${base}/tesseract.js-core@v5.1.1/${coreFile}`,
};

/**
 * 管理基金扫描导入功能（完整版）
 * 包含：OCR 识别、LLM 解析、基金验证、模糊匹配
 */
export function useFundScanner(options = {}) {
  const {
    funds = [],
    onScanComplete,
    onScanError,
    onFundVerified,
    ocrTimeout = 30000,
    searchTimeout = 8000,
    verifyConcurrency = 5,
    importConcurrency = 5,
  } = options;

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ stage: 'idle', current: 0, total: 0 });
  const [scanResults, setScanResults] = useState([]);
  const [scanError, setScanError] = useState(null);
  const workerRef = useRef(null);
  const abortScanRef = useRef(false);

  // 初始化 OCR Worker
  const initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;

    let lastErr = null;
    for (const base of OCR_CONFIG.cdnBases) {
      for (const coreFile of OCR_CONFIG.coreCandidates) {
        try {
          const worker = await createWorker('chi_sim+eng', 1, {
            workerPath: OCR_CONFIG.workerPath(base),
            corePath: OCR_CONFIG.corePath(base, coreFile),
          });
          workerRef.current = worker;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!lastErr) break;
    }

    if (lastErr) throw lastErr;
    return workerRef.current;
  }, []);

  // 带超时的 OCR 识别
  const recognizeWithTimeout = useCallback(async (file, ms) => {
    const worker = workerRef.current;
    if (!worker) throw new Error('OCR Worker not initialized');

    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms);
    });

    try {
      return await Promise.race([worker.recognize(file), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  // 带超时的基金搜索
  const searchFundsWithTimeout = useCallback(async (val, ms) => {
    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve([]), ms);
    });

    try {
      return await Promise.race([searchFunds(val), timeout]);
    } catch (e) {
      return [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  // 模糊匹配基金代码（从公共数据）
  const resolveFundCodeByFuzzy = useCallback(async (fundName) => {
    try {
      const response = await fetch('/allFunds.json');
      const allFunds = await response.json();
      // 简单模糊匹配：查找包含 fundName 的基金
      const matches = allFunds.filter(f =>
        f.NAME?.includes(fundName) || f.SHORTNAME?.includes(fundName)
      );
      return matches.length === 1 ? matches[0].CODE : null;
    } catch (e) {
      return null;
    }
  }, []);

  // 处理扫描文件
  const processFiles = useCallback(async (files, options = {}) => {
    const { onProgress, fuzzyResolver } = options;

    if (!files?.length) return [];

    abortScanRef.current = false;
    setIsScanning(true);
    setScanError(null);
    setScanProgress({ stage: 'ocr', current: 0, total: files.length });

    try {
      // 初始化 Worker
      await initWorker();

      const allFundsData = [];
      const addedFundCodes = new Set();

      // OCR 识别阶段
      for (let i = 0; i < files.length; i++) {
        if (abortScanRef.current) break;

        const file = files[i];
        setScanProgress(prev => ({ ...prev, current: i + 1 }));
        if (onProgress) onProgress('ocr', i + 1, files.length);

        let text = '';
        try {
          const res = await recognizeWithTimeout(file, ocrTimeout);
          text = res?.data?.text || '';
        } catch (e) {
          if (String(e?.message || '').includes('OCR_TIMEOUT')) {
            // 超时后尝试重新初始化 worker
            if (workerRef.current) {
              try {
                await workerRef.current.terminate();
              } catch { }
              workerRef.current = null;
            }
            throw e;
          }
          text = '';
        }

        // 使用 LLM 解析基金信息
        if (text) {
          try {
            const fundsResString = await parseFundTextWithLLM(text);
            const fundsRes = JSON.parse(fundsResString);

            if (Array.isArray(fundsRes) && fundsRes.length > 0) {
              fundsRes.forEach((fund) => {
                const code = fund.fundCode || '';
                const name = (fund.fundName || '').trim();

                if (code && !addedFundCodes.has(code)) {
                  addedFundCodes.add(code);
                  allFundsData.push({
                    fundCode: code,
                    fundName: name,
                    holdAmounts: fund.holdAmounts || '',
                    holdGains: fund.holdGains || '',
                  });
                } else if (!code && name) {
                  // 只有名称没有代码，需要后续搜索
                  allFundsData.push({
                    fundCode: '',
                    fundName: name,
                    holdAmounts: fund.holdAmounts || '',
                    holdGains: fund.holdGains || '',
                  });
                }
              });
            }
          } catch (e) {
            console.error('LLM 解析失败:', e);
          }
        }
      }

      if (abortScanRef.current) {
        return [];
      }

      // 搜索缺失的基金代码
      const fundsWithoutCode = allFundsData.filter(f => !f.fundCode && f.fundName);
      if (fundsWithoutCode.length > 0) {
        setScanProgress({ stage: 'verify', current: 0, total: fundsWithoutCode.length });

        for (let i = 0; i < fundsWithoutCode.length; i++) {
          if (abortScanRef.current) break;

          const fundItem = fundsWithoutCode[i];
          setScanProgress(prev => ({ ...prev, current: i + 1 }));
          if (onProgress) onProgress('search', i + 1, fundsWithoutCode.length);

          try {
            const list = await searchFundsWithTimeout(fundItem.fundName, searchTimeout);
            // 只有唯一结果时才采用
            if (Array.isArray(list) && list.length === 1) {
              const found = list[0];
              if (found?.CODE && !addedFundCodes.has(found.CODE)) {
                addedFundCodes.add(found.CODE);
                fundItem.fundCode = found.CODE;
              }
            } else {
              // 使用模糊匹配作为备选
              const resolver = fuzzyResolver || resolveFundCodeByFuzzy;
              const fuzzyCode = await resolver(fundItem.fundName);
              if (fuzzyCode && !addedFundCodes.has(fuzzyCode)) {
                addedFundCodes.add(fuzzyCode);
                fundItem.fundCode = fuzzyCode;
              }
            }
          } catch (e) {
            // 搜索失败继续下一个
          }
        }
      }

      // 过滤出有效基金
      const validFunds = allFundsData.filter(f => f.fundCode);
      const codes = validFunds.map(f => f.fundCode).sort();

      // 验证基金有效性
      setScanProgress({ stage: 'verify', current: 0, total: codes.length });
      const existingCodes = new Set(funds.map(f => f.code));
      const results = [];

      for (let i = 0; i < codes.length; i++) {
        if (abortScanRef.current) break;

        const code = codes[i];
        const fundInfo = validFunds.find(f => f.fundCode === code);
        setScanProgress(prev => ({ ...prev, current: i + 1 }));
        if (onProgress) onProgress('verify', i + 1, codes.length);

        let found = null;
        try {
          const list = await searchFundsWithTimeout(code, searchTimeout);
          found = Array.isArray(list) ? list.find(d => d.CODE === code) : null;
        } catch (e) {
          found = null;
        }

        const alreadyAdded = existingCodes.has(code);
        const ok = !!found && !alreadyAdded;

        results.push({
          code,
          name: found ? (found.NAME || found.SHORTNAME || '') : (fundInfo?.fundName || ''),
          status: alreadyAdded ? 'added' : (ok ? 'ok' : 'invalid'),
          holdAmounts: fundInfo?.holdAmounts || '',
          holdGains: fundInfo?.holdGains || '',
        });
      }

      setScanResults(results);

      if (abortScanRef.current) {
        return [];
      }

      if (onScanComplete) {
        onScanComplete(results);
      }

      return results;
    } catch (error) {
      setScanError(error.message || '扫描失败');
      if (onScanError) onScanError(error);
      throw error;
    } finally {
      setIsScanning(false);
    }
  }, [
    initWorker, recognizeWithTimeout, searchFundsWithTimeout, resolveFundCodeByFuzzy,
    funds, ocrTimeout, searchTimeout, onScanComplete, onScanError,
  ]);

  // 确认导入扫描结果
  const confirmScanImport = useCallback(async (selectedCodes, options = {}) => {
    const {
      targetGroupId = 'all',
      expandAfterAdd = true,
      onImportComplete,
      onImportProgress,
    } = options;

    if (!Array.isArray(selectedCodes) || selectedCodes.length === 0) {
      return { success: false, added: [], message: '未选择任何基金' };
    }

    const uniqueCodes = Array.from(new Set(selectedCodes));
    const toAdd = uniqueCodes.filter(c => !funds.some(f => f.code === c));

    if (toAdd.length === 0) {
      return { success: true, added: [], message: '识别的基金已全部添加' };
    }

    setIsScanning(true);
    setScanProgress({ stage: 'import', current: 0, total: toAdd.length });

    try {
      const added = [];

      await asyncPool(importConcurrency, toAdd, async (code) => {
        try {
          const data = await fetchFundData(code);
          if (data && data.code) {
            // 添加基准快照
            const dwjz = Number(data?.dwjz);
            const gsz = Number(data?.gsz);
            if (Number.isFinite(dwjz) && dwjz > 0) {
              data.addBaseNav = dwjz;
              data.addBaseDate = data?.jzrq || null;
            } else if (Number.isFinite(gsz) && gsz > 0) {
              data.addBaseNav = gsz;
              data.addBaseDate = data?.gztime || data?.time || null;
            }
            if (data.addedAt == null) data.addedAt = Date.now();

            added.push(data);
          }
        } catch (e) {
          console.error(`通过识别导入基金 ${code} 失败`, e);
        }

        setScanProgress(prev => ({
          ...prev,
          current: prev.current + 1,
        }));
        if (onImportProgress) {
          onImportProgress(added.length, toAdd.length);
        }
      });

      if (onImportComplete) {
        onImportComplete(added, toAdd.length);
      }

      return {
        success: true,
        added,
        total: toAdd.length,
        message: `已导入 ${added.length} 只基金`,
      };
    } finally {
      setIsScanning(false);
    }
  }, [funds, importConcurrency]);

  // 终止扫描
  const abortScan = useCallback(() => {
    abortScanRef.current = true;
    setIsScanning(false);
  }, []);

  // 清理 Worker
  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      try {
        await workerRef.current.terminate();
      } catch { }
      workerRef.current = null;
    }
  }, []);

  // 重置状态
  const resetScan = useCallback(() => {
    setScanResults([]);
    setScanProgress({ stage: 'idle', current: 0, total: 0 });
    setScanError(null);
    abortScanRef.current = false;
  }, []);

  // 切换结果选中状态
  const toggleResultSelection = useCallback((code) => {
    setScanResults((prev) =>
      prev.map((item) =>
        item.code === code ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  // 全选/取消全选
  const selectAllResults = useCallback((selected) => {
    setScanResults((prev) =>
      prev.map((item) => ({ ...item, selected }))
    );
  }, []);

  // 获取选中的基金代码
  const getSelectedCodes = useCallback(() => {
    return scanResults
      .filter((item) => item.selected)
      .map((item) => item.code);
  }, [scanResults]);

  return {
    isScanning,
    scanProgress,
    scanResults,
    scanError,
    processFiles,
    confirmScanImport,
    abortScan,
    resetScan,
    toggleResultSelection,
    selectAllResults,
    getSelectedCodes,
    terminateWorker,
  };
}

/**
 * 管理文件拖拽上传
 */
export function useFileDrop(onFilesDrop, options = {}) {
  const { accept = 'image/*', multiple = true } = options;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      if (accept === 'image/*') {
        return file.type.startsWith('image/');
      }
      return true;
    });

    if (files.length > 0) {
      onFilesDrop(multiple ? files : [files[0]]);
    }
  }, [onFilesDrop, accept, multiple]);

  return {
    isDragging,
    handlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}

/**
 * 管理剪贴板粘贴图片
 */
export function useClipboardPaste(onImagePaste) {
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          onImagePaste(file);
          break;
        }
      }
    }
  }, [onImagePaste]);

  return { handlePaste };
}
