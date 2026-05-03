import { useState, useCallback, useMemo, useRef } from 'react';
import { isPlainObject } from 'lodash';

/**
 * 管理拖拽排序
 * @param {Array} items - 初始项目列表
 * @param {Object} options - 配置选项
 */
export function useDragSort(items, options = {}) {
  const {
    keyExtractor = (item) => item.id || item.code,
    onOrderChange,
    enabled = true,
  } = options;

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragNodeRef = useRef(null);

  // 计算排序后的列表
  const sortedItems = useMemo(() => {
    return items || [];
  }, [items]);

  // 开始拖拽
  const handleDragStart = useCallback((e, item) => {
    if (!enabled) return;

    const key = keyExtractor(item);
    setDraggingId(key);
    dragNodeRef.current = e.target;

    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);

    // 延迟添加样式以显示拖拽状态
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  }, [enabled, keyExtractor]);

  // 拖拽经过
  const handleDragOver = useCallback((e, item) => {
    if (!enabled) return;
    e.preventDefault();

    const key = keyExtractor(item);
    if (key !== draggingId) {
      setDragOverId(key);
    }
  }, [enabled, keyExtractor, draggingId]);

  // 拖拽进入
  const handleDragEnter = useCallback((e, item) => {
    if (!enabled) return;
    e.preventDefault();

    const key = keyExtractor(item);
    if (key !== draggingId) {
      setDragOverId(key);
    }
  }, [enabled, keyExtractor, draggingId]);

  // 拖拽离开
  const handleDragLeave = useCallback((e) => {
    if (!enabled) return;
    // 只在真正离开元素时清除状态
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setDragOverId(null);
    }
  }, [enabled]);

  // 放置
  const handleDrop = useCallback((e, targetItem) => {
    if (!enabled) return;
    e.preventDefault();

    const targetKey = keyExtractor(targetItem);
    if (targetKey === draggingId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    // 重新排序
    const newItems = [...items];
    const dragIndex = newItems.findIndex((item) => keyExtractor(item) === draggingId);
    const dropIndex = newItems.findIndex((item) => keyExtractor(item) === targetKey);

    if (dragIndex !== -1 && dropIndex !== -1) {
      const [removed] = newItems.splice(dragIndex, 1);
      newItems.splice(dropIndex, 0, removed);

      if (onOrderChange) {
        onOrderChange(newItems);
      }
    }

    setDraggingId(null);
    setDragOverId(null);
  }, [enabled, items, keyExtractor, draggingId, onOrderChange]);

  // 拖拽结束
  const handleDragEnd = useCallback((e) => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove('dragging');
    }
    setDraggingId(null);
    setDragOverId(null);
    dragNodeRef.current = null;
  }, []);

  // 判断项目是否正在拖拽
  const isDragging = useCallback((item) => {
    return keyExtractor(item) === draggingId;
  }, [keyExtractor, draggingId]);

  // 判断项目是否为拖拽目标
  const isDragOver = useCallback((item) => {
    return keyExtractor(item) === dragOverId;
  }, [keyExtractor, dragOverId]);

  // 获取拖拽相关的 props
  const getDragProps = useCallback((item) => {
    if (!enabled) return {};

    return {
      draggable: true,
      onDragStart: (e) => handleDragStart(e, item),
      onDragEnd: handleDragEnd,
      onDragOver: (e) => handleDragOver(e, item),
      onDragEnter: (e) => handleDragEnter(e, item),
      onDragLeave: handleDragLeave,
      onDrop: (e) => handleDrop(e, item),
      'data-dragging': isDragging(item),
      'data-drag-over': isDragOver(item),
    };
  }, [enabled, handleDragStart, handleDragEnd, handleDragOver, handleDragEnter, handleDragLeave, handleDrop, isDragging, isDragOver]);

  return {
    draggingId,
    dragOverId,
    sortedItems,
    getDragProps,
    isDragging,
    isDragOver,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}

/**
 * 管理分组操作
 * @param {Object} options - 配置选项
 */
export function useGroupManager(options = {}) {
  const {
    initialGroups = [],
    onGroupsChange,
    maxGroups = 20,
  } = options;

  const [groups, setGroups] = useState(initialGroups);
  const [editingGroup, setEditingGroup] = useState(null);

  // 创建新分组
  const createGroup = useCallback((name, codes = []) => {
    if (groups.length >= maxGroups) {
      throw new Error(`最多只能创建 ${maxGroups} 个分组`);
    }

    const newGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      codes: [...codes],
      createdAt: new Date().toISOString(),
    };

    const updated = [...groups, newGroup];
    setGroups(updated);

    if (onGroupsChange) {
      onGroupsChange(updated);
    }

    return newGroup;
  }, [groups, maxGroups, onGroupsChange]);

  // 更新分组
  const updateGroup = useCallback((groupId, updates) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, ...updates };
      }
      return g;
    });

    setGroups(updated);

    if (onGroupsChange) {
      onGroupsChange(updated);
    }
  }, [groups, onGroupsChange]);

  // 删除分组
  const deleteGroup = useCallback((groupId) => {
    const updated = groups.filter((g) => g.id !== groupId);
    setGroups(updated);

    if (onGroupsChange) {
      onGroupsChange(updated);
    }
  }, [groups, onGroupsChange]);

  // 向分组添加基金
  const addFundToGroup = useCallback((groupId, code) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (group.codes.includes(code)) {
      return false; // 已存在
    }

    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, codes: [...g.codes, code] };
      }
      return g;
    });

    setGroups(updated);

    if (onGroupsChange) {
      onGroupsChange(updated);
    }

    return true;
  }, [groups, onGroupsChange]);

  // 从分组移除基金
  const removeFundFromGroup = useCallback((groupId, code) => {
    const updated = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, codes: g.codes.filter((c) => c !== code) };
      }
      return g;
    });

    setGroups(updated);

    if (onGroupsChange) {
      onGroupsChange(updated);
    }
  }, [groups, onGroupsChange]);

  // 重命名分组
  const renameGroup = useCallback((groupId, newName) => {
    if (!newName || !newName.trim()) return;

    updateGroup(groupId, { name: newName.trim() });
  }, [updateGroup]);

  // 获取分组中的基金
  const getGroupFunds = useCallback((groupId, allFunds) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return [];

    return (allFunds || []).filter((f) => group.codes.includes(f.code));
  }, [groups]);

  // 检查基金是否在分组中
  const isFundInGroup = useCallback((code, groupId) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return false;
    return group.codes.includes(code);
  }, [groups]);

  // 获取基金所在的所有分组
  const getFundGroups = useCallback((code) => {
    return groups.filter((g) => g.codes.includes(code));
  }, [groups]);

  return {
    groups,
    setGroups,
    editingGroup,
    setEditingGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    addFundToGroup,
    removeFundFromGroup,
    renameGroup,
    getGroupFunds,
    isFundInGroup,
    getFundGroups,
  };
}

/**
 * 管理表格选择
 * @param {Array} data - 表格数据
 * @param {Object} options - 配置选项
 */
export function useTableSelection(data, options = {}) {
  const {
    keyExtractor = (item) => item.id || item.code,
    onSelectionChange,
  } = options;

  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // 选中的项目列表
  const selectedItems = useMemo(() => {
    const keySet = selectedKeys;
    return (data || []).filter((item) => keySet.has(keyExtractor(item)));
  }, [data, selectedKeys, keyExtractor]);

  // 是否全选
  const isAllSelected = useMemo(() => {
    return data.length > 0 && data.every((item) => selectedKeys.has(keyExtractor(item)));
  }, [data, selectedKeys, keyExtractor]);

  // 是否有选中项
  const hasSelection = selectedKeys.size > 0;

  // 选中单个
  const select = useCallback((item) => {
    const key = keyExtractor(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (onSelectionChange) {
        const selected = data.filter((d) => next.has(keyExtractor(d)));
        onSelectionChange(selected);
      }
      return next;
    });
  }, [keyExtractor, data, onSelectionChange]);

  // 取消选中单个
  const deselect = useCallback((item) => {
    const key = keyExtractor(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      if (onSelectionChange) {
        const selected = data.filter((d) => next.has(keyExtractor(d)));
        onSelectionChange(selected);
      }
      return next;
    });
  }, [keyExtractor, data, onSelectionChange]);

  // 切换选中状态
  const toggle = useCallback((item) => {
    const key = keyExtractor(item);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (onSelectionChange) {
        const selected = data.filter((d) => next.has(keyExtractor(d)));
        onSelectionChange(selected);
      }
      return next;
    });
  }, [keyExtractor, data, onSelectionChange]);

  // 全选
  const selectAll = useCallback(() => {
    const keys = new Set(data.map((item) => keyExtractor(item)));
    setSelectedKeys(keys);
    if (onSelectionChange) {
      onSelectionChange(data);
    }
  }, [data, keyExtractor, onSelectionChange]);

  // 取消全选
  const deselectAll = useCallback(() => {
    setSelectedKeys(new Set());
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);

  // 切换全选
  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, deselectAll, selectAll]);

  // 获取行的选中状态
  const getRowProps = useCallback((item) => {
    const key = keyExtractor(item);
    const isSelected = selectedKeys.has(key);

    return {
      'data-selected': isSelected,
      onClick: () => toggle(item),
    };
  }, [keyExtractor, selectedKeys, toggle]);

  return {
    selectedKeys,
    selectedItems,
    hasSelection,
    isAllSelected,
    select,
    deselect,
    toggle,
    selectAll,
    deselectAll,
    toggleAll,
    getRowProps,
  };
}
