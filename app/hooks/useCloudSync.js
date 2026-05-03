import { useState, useCallback, useRef } from 'react';
import { isPlainObject, isEqual } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

/**
 * 管理云端配置同步
 * @param {Object} supabase - Supabase 客户端
 * @param {Object} options - 配置选项
 */
export function useCloudSync(supabase, options = {}) {
  const {
    onConfigApplied,
    onConflictDetected,
    onSyncError,
    onSyncSuccess,
  } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [pendingSync, setPendingSync] = useState(false);
  const lastSyncedRef = useRef(null);
  const skipSyncRef = useRef(false);

  // 获取云端配置
  const fetchCloudConfig = useCallback(async (userId, checkConflict = false) => {
    if (!userId || !supabase) return null;

    try {
      const { data: meta, error: metaError } = await supabase
        .from('user_configs')
        .select('id, data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (metaError) throw metaError;

      // 如果没有配置记录，创建空记录
      if (!meta?.id) {
        const { error: insertError } = await supabase
          .from('user_configs')
          .insert({ user_id: userId });
        if (insertError) throw insertError;
        return { type: 'empty' };
      }

      // 冲突检查模式
      if (checkConflict) {
        return {
          type: 'conflict',
          data: meta.data,
          updatedAt: meta.updated_at,
        };
      }

      // 直接应用云端配置
      if (meta.data && isPlainObject(meta.data) && Object.keys(meta.data).length > 0) {
        if (onConfigApplied) {
          await onConfigApplied(meta.data, meta.updated_at);
        }
        lastSyncedRef.current = getComparablePayload(meta.data);
        setLastSyncTime(new Date());
        return { type: 'applied', data: meta.data };
      }

      return { type: 'empty' };
    } catch (error) {
      setSyncError(error.message);
      if (onSyncError) onSyncError(error);
      throw error;
    }
  }, [supabase, onConfigApplied, onSyncError]);

  // 全量更新辅助函数
  const fullUpdate = async (userId, data, now, deviceId) => {
    const { error } = await supabase
      .from('user_configs')
      .upsert(
        {
          user_id: userId,
          data,
          updated_at: now,
          last_device_id: deviceId,
        },
        { onConflict: 'user_id' }
      );
    if (error) throw error;
  };

  // 同步本地配置到云端
  const syncToCloud = useCallback(async (userId, payload = null, isPartial = false) => {
    if (!userId || !supabase) {
      throw new Error('用户未登录或 Supabase 未配置');
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const dataToSync = payload || collectLocalPayload();
      const now = new Date().toISOString();
      const deviceId = getOrCreateDeviceId();

      const syncData = {
        ...dataToSync,
        _syncMeta: {
          ...(dataToSync._syncMeta || {}),
          deviceId,
          at: now,
        },
      };

      if (isPartial) {
        // 增量更新
        const { error: rpcError } = await supabase.rpc('update_user_config_partial', {
          payload: syncData,
          p_last_device_id: deviceId,
        });

        if (rpcError) {
          // 回退到全量更新
          await fullUpdate(userId, syncData, now, deviceId);
        }
      } else {
        // 全量更新
        await fullUpdate(userId, syncData, now, deviceId);
      }

      lastSyncedRef.current = getComparablePayload(dataToSync);
      setLastSyncTime(new Date());

      if (onSyncSuccess) {
        onSyncSuccess();
      }

      return { success: true };
    } catch (error) {
      setSyncError(error.message);
      if (onSyncError) onSyncError(error);
      throw error;
    } finally {
      setIsSyncing(false);
      skipSyncRef.current = false;
    }
  }, [supabase, onSyncSuccess, onSyncError, fullUpdate]);

  // 检查是否需要同步
  const checkNeedSync = useCallback((currentPayload) => {
    if (skipSyncRef.current) return false;
    const comparable = getComparablePayload(currentPayload);
    return !isEqual(comparable, lastSyncedRef.current);
  }, []);

  // 应用云端配置（覆盖本地）
  const applyCloudConfig = useCallback(async (cloudData, cloudUpdatedAt) => {
    if (!cloudData || !isPlainObject(cloudData)) return;

    skipSyncRef.current = true;

    try {
      // 应用配置到本地存储
      Object.entries(cloudData).forEach(([key, value]) => {
        if (key.startsWith('_')) return; // 跳过元数据
        localStorage.setItem(key, JSON.stringify(value));
      });

      // 更新时间戳
      localStorage.setItem('cloudUpdatedAt', cloudUpdatedAt);
      localStorage.setItem('localUpdatedAt', new Date().toISOString());

      if (onConfigApplied) {
        await onConfigApplied(cloudData, cloudUpdatedAt);
      }

      lastSyncedRef.current = getComparablePayload(cloudData);
      setLastSyncTime(new Date());
    } finally {
      skipSyncRef.current = false;
    }
  }, [onConfigApplied]);

  // 合并云端和本地配置
  const mergeConfigs = useCallback(async (cloudData, localData, strategy = 'cloud') => {
    let merged;

    switch (strategy) {
      case 'cloud':
        merged = { ...localData, ...cloudData };
        break;
      case 'local':
        merged = { ...cloudData, ...localData };
        break;
      case 'merge':
        merged = mergeFundLists(cloudData, localData);
        break;
      default:
        merged = cloudData;
    }

    return merged;
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    syncError,
    pendingSync,
    fetchCloudConfig,
    syncToCloud,
    checkNeedSync,
    applyCloudConfig,
    mergeConfigs,
    setPendingSync,
  };
}

/**
 * 收集本地配置数据
 * @returns {Object} 本地配置数据
 */
function collectLocalPayload() {
  const keys = [
    'funds',
    'groups',
    'favorites',
    'collapsedCodes',
    'collapsedTrends',
    'collapsedEarnings',
    'holdings',
    'groupHoldings',
    'pendingTrades',
    'transactions',
    'dcaPlans',
    'customSettings',
    'fundDailyEarnings',
    'sortRules',
    'tags',
  ];

  const payload = {};
  keys.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        payload[key] = JSON.parse(value);
      }
    } catch (e) {
      console.warn(`读取 ${key} 失败:`, e);
    }
  });

  return payload;
}

/**
 * 获取可比较的配置数据（去除时间戳等可变字段）
 * @param {Object} payload - 配置数据
 * @returns {Object} 可比较的配置
 */
function getComparablePayload(payload) {
  if (!payload || !isPlainObject(payload)) return payload;
  const { _syncMeta, updated_at, localUpdatedAt, ...rest } = payload;
  return rest;
}

/**
 * 获取或创建设备 ID
 * @returns {string} 设备 ID
 */
function getOrCreateDeviceId() {
  const key = 'rtfDeviceId';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/**
 * 合并基金列表（取并集）
 * @param {Object} cloudData - 云端数据
 * @param {Object} localData - 本地数据
 * @returns {Object} 合并后的数据
 */
function mergeFundLists(cloudData, localData) {
  const merged = { ...cloudData };

  // 合并基金列表
  if (localData.funds && Array.isArray(localData.funds)) {
    const cloudCodes = new Set((cloudData.funds || []).map((f) => f.code));
    const newFunds = localData.funds.filter((f) => !cloudCodes.has(f.code));
    merged.funds = [...(cloudData.funds || []), ...newFunds];
  }

  // 合并分组
  if (localData.groups && Array.isArray(localData.groups)) {
    const cloudIds = new Set((cloudData.groups || []).map((g) => g.id));
    const newGroups = localData.groups.filter((g) => !cloudIds.has(g.id));
    merged.groups = [...(cloudData.groups || []), ...newGroups];
  }

  return merged;
}
