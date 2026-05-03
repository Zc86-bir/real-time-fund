import { useMemo, useCallback } from 'react';
import {
  normalizeFundTagTheme,
  getFundCodesFromTagRecord,
  mergeTagRowsByName,
  sanitizeTagRowForStorage,
  serializeTagRecordsForCompare,
  stripLegacyTagsFromFundObject,
  DEFAULT_FUND_TAG_THEME,
} from '../lib/fundHelpers';

/**
 * 管理基金标签
 * @param {Array} fundTagRecords - 标签记录列表
 * @param {Array} funds - 基金列表
 */
export function useFundTags(fundTagRecords, funds) {
  // 根据标签记录和基金列表生成每只基金的标签列表
  const fundTagListsByCode = useMemo(() => {
    const out = {};
    const codeSet = new Set(
      (funds || []).map((f) => String(f?.code ?? '').trim()).filter(Boolean)
    );

    for (const r of fundTagRecords || []) {
      if (!r || typeof r !== 'object') continue;
      const id = String(r.id ?? '').trim();
      const name = String(r.name ?? '').trim();
      if (!id || !name) continue;
      const theme = normalizeFundTagTheme(r.theme);

      // 获取该基金标签下的所有基金代码
      const codes = getFundCodesFromTagRecord(r);
      for (const c of codes) {
        if (!codeSet.has(c)) continue;
        if (!out[c]) out[c] = [];
        out[c].push({ id, name, theme });
      }
    }

    // 对每个基金的标签按名称排序
    Object.keys(out).forEach((c) => {
      out[c] = out[c]
        .filter((x) => x?.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    });

    return out;
  }, [fundTagRecords, funds]);

  // 获取指定基金的标签
  const getFundTags = useCallback(
    (code) => {
      return fundTagListsByCode[code] || [];
    },
    [fundTagListsByCode]
  );

  // 检查基金是否有标签
  const hasTags = useCallback(
    (code) => {
      const tags = fundTagListsByCode[code];
      return tags && tags.length > 0;
    },
    [fundTagListsByCode]
  );

  // 获取标签键（用于排序/分组）
  const getTagKeyForFund = useCallback(
    (fund) => {
      if (!fund?.code) return '';
      const tags = fundTagListsByCode[fund.code] || [];
      if (tags.length === 0) return '';
      return tags.map((t) => t.name).join(',');
    },
    [fundTagListsByCode]
  );

  return {
    fundTagListsByCode,
    getFundTags,
    hasTags,
    getTagKeyForFund,
  };
}

// 导出从 fundHelpers 导入的工具函数
export {
  normalizeFundTagTheme,
  getFundCodesFromTagRecord,
  mergeTagRowsByName,
  sanitizeTagRowForStorage,
  serializeTagRecordsForCompare,
  stripLegacyTagsFromFundObject,
  DEFAULT_FUND_TAG_THEME,
};
