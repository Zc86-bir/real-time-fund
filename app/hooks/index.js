// Hooks 导出索引

// 原有 Hook
export { useFundFuzzyMatcher } from './useFundFuzzyMatcher';

// 基础 Hooks
export {
  useAutoRefresh,
  useResponsiveLayout,
  useModalState,
  useModalsState,
} from './useCommon';

// 基金标签 Hooks
export {
  useFundTags,
  normalizeFundTagTheme,
  getFundCodesFromTagRecord,
  mergeTagRowsByName,
  sanitizeTagRowForStorage,
  serializeTagRecordsForCompare,
  stripLegacyTagsFromFundObject,
  DEFAULT_FUND_TAG_THEME,
} from './useFundTags';

// 持仓 Hooks
export {
  useHoldingCalculations,
  useGroupHoldings,
  cloneHoldingDeep,
  normalizeHoldingEntryForSeed,
  seedGroupHoldingsFromGlobal,
  hasOwn,
  DCA_SCOPE_GLOBAL,
  SUMMARY_TAB_ID,
  SUMMARY_SOURCE_GLOBAL,
} from './useHoldings';

// 增强版持仓 Hooks（推荐用于 page.jsx 重构）
export {
  useHoldingsEnhanced,
  cloneHoldingDeep as cloneHoldingDeepEnhanced,
  normalizeHoldingEntryForSeed as normalizeHoldingEntryForSeedEnhanced,
  seedGroupHoldingsFromGlobal as seedGroupHoldingsFromGlobalEnhanced,
  hasOwn as hasOwnEnhanced,
} from './useHoldingsEnhanced';

// 排序 Hooks
export {
  useFundSorting,
  SORT_TYPES,
  SORT_ORDERS,
  DEFAULT_SORT_RULES,
  parseSortSettings,
  serializeSortSettings,
} from './useFundSorting';

// 扫描导入 Hooks
export {
  useFundScanner,
  useFileDrop,
  useClipboardPaste,
} from './useScanImport';

// 表格数据 Hooks
export {
  useTableData,
} from './useTableData';

// 基金表格数据 Hook
export {
  useFundTableData,
} from './useFundTableData';

// 云端同步 Hooks
export {
  useCloudSync,
} from './useCloudSync';

// 基金刷新与搜索 Hooks
export {
  useFundRefresh,
  useSearchHistory,
  useFundSearch,
} from './useFundRefresh';

// 表格与分组 Hooks
export {
  useDragSort,
  useGroupManager,
  useTableSelection,
} from './useTableAndGroup';

// 基金提醒 Hooks
export {
  useFundAlerts,
} from './useFundAlerts';

// 基金排序 Hooks
export {
  useSortedFunds,
} from './useSortedFunds';

// 当前 tab 每日收益 Hooks
export {
  useCurrentFundDailyEarnings,
} from './useCurrentFundDailyEarnings';

// 关联持仓计算 Hooks
export {
  useLinkedHoldings,
} from './useLinkedHoldings';

// 汇总卡片数据 Hooks
export {
  useSummaryCards,
} from './useSummaryCards';

// 区间收益数据 Hooks
export {
  useSortPeriodReturns,
} from './useSortPeriodReturns';
