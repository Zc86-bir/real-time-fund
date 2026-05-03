'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TrashIcon, PlusIcon } from './Icons';

// 内联 SVG 图标（Icons.jsx 中没有铃铛图标）
function BellIcon(props) {
  return (
    <svg width={props.width || 16} height={props.height || 16} viewBox="0 0 24 24" fill="none" stroke={props.style?.color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BellOffIcon(props) {
  return (
    <svg width={props.width || 16} height={props.height || 16} viewBox="0 0 24 24" fill="none" stroke={props.style?.color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.074 15.475a8.41 8.41 0 0 1-1.24 1.725" />
      <path d="M14.704 18.361a2 2 0 0 1-3.41 0" />
      <path d="M6.274 11.785A12.083 12.083 0 0 1 6 8c0-3.314 2.686-6 6-6" />
      <path d="M2 2l20 20" />
      <path d="M15.536 19.057A9.727 9.727 0 0 0 18 8" />
      <path d="M18 14.589l3.235 3.235a1 1 0 0 1-1.414 1.414L16.589 16" />
    </svg>
  );
}

export default function AlertSettingsModal({ open, onClose, funds = [], useFundAlertsReturn }) {
  const {
    alerts,
    setAlert,
    removeAlert,
    requestPermission,
    notificationSupported,
    notificationPermission,
  } = useFundAlertsReturn || {};

  const [localAlerts, setLocalAlerts] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlert, setNewAlert] = useState({ code: '', threshold: 3, direction: 'both' });

  useEffect(() => {
    if (open && alerts) {
      setLocalAlerts(JSON.parse(JSON.stringify(alerts)));
    }
  }, [open, alerts]);

  const handleRequestPermission = async () => {
    if (requestPermission) {
      await requestPermission();
    }
  };

  const handleAddAlert = () => {
    if (!newAlert.code || !newAlert.threshold) return;
    setAlert(newAlert.code, {
      threshold: Number(newAlert.threshold),
      direction: newAlert.direction,
      enabled: true,
    });
    setNewAlert({ code: '', threshold: 3, direction: 'both' });
    setShowAddForm(false);
  };

  const handleToggleAlert = (code) => {
    const existing = localAlerts[code];
    if (!existing) return;
    setAlert(code, { ...existing, enabled: !existing.enabled });
  };

  const handleRemoveAlert = (code) => {
    removeAlert(code);
    setLocalAlerts((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const fundByCode = new Map(funds.map((f) => [f.code, f]));

  const directionLabel = { up: '涨', down: '跌', both: '涨跌' };
  const directionColor = { up: 'var(--danger)', down: 'var(--success)', both: 'var(--primary)' };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="flex-shrink-0 space-y-0 px-6 pb-4 pt-6 border-b border-[var(--border)]">
          <DialogTitle className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
            <BellIcon width="18" height="18" />
            涨跌提醒设置
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 scrollbar-y-styled">
          {/* 通知权限状态 */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.05))' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {notificationPermission === 'granted' ? (
                  <BellIcon width="16" height="16" style={{ color: 'var(--success)' }} />
                ) : (
                  <BellOffIcon width="16" height="16" style={{ color: 'var(--muted)' }} />
                )}
                <span className="text-sm" style={{ color: 'var(--text)' }}>
                  浏览器通知
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {notificationPermission === 'granted' ? '已开启' :
                 notificationPermission === 'denied' ? '已拒绝' :
                 notificationSupported ? '未授权' : '不支持'}
              </span>
              {notificationPermission !== 'granted' && notificationSupported && (
                <Button size="sm" variant="ghost" onClick={handleRequestPermission} className="ml-2">
                  开启
                </Button>
              )}
            </div>
          </div>

          {/* 已设置的提醒列表 */}
          {Object.keys(localAlerts).length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                已设置提醒
              </h4>
              {Object.entries(localAlerts).map(([code, config]) => {
                const fund = fundByCode.get(code);
                const name = fund?.name || `基金(${code})`;
                return (
                  <div
                    key={code}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
                      opacity: config.enabled ? 1 : 0.5,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" style={{ borderColor: directionColor[config.direction], color: directionColor[config.direction] }}>
                          {directionLabel[config.direction]}超 {config.threshold}%
                        </Badge>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          {config.enabled ? '已启用' : '已暂停'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleAlert(code)}
                        aria-label={config.enabled ? '暂停提醒' : '启用提醒'}
                      />
                      <button
                        onClick={() => handleRemoveAlert(code)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="删除提醒"
                      >
                        <TrashIcon width="14" height="14" style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
              <BellOffIcon width="32" height="32" className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无涨跌提醒</p>
              <p className="text-xs mt-1">添加基金后设置涨跌幅阈值即可</p>
            </div>
          )}

          {/* 添加新提醒 */}
          {showAddForm ? (
            <div className="mt-4 p-4 rounded-lg border border-[var(--border)]">
              <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
                添加提醒
              </h4>

              {/* 选择基金 */}
              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>基金</label>
                <select
                  className="w-full p-2 rounded text-sm border border-[var(--border)] bg-transparent"
                  style={{ color: 'var(--text)' }}
                  value={newAlert.code}
                  onChange={(e) => setNewAlert((prev) => ({ ...prev, code: e.target.value }))}
                >
                  <option value="">选择基金</option>
                  {funds.map((f) => (
                    <option key={f.code} value={f.code}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              {/* 阈值 */}
              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>涨跌幅阈值 (%)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className="w-full p-2 rounded text-sm border border-[var(--border)] bg-transparent"
                  style={{ color: 'var(--text)' }}
                  value={newAlert.threshold}
                  onChange={(e) => setNewAlert((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
                />
              </div>

              {/* 方向 */}
              <div className="mb-4">
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>触发方向</label>
                <div className="flex gap-2">
                  {['up', 'down', 'both'].map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setNewAlert((prev) => ({ ...prev, direction: dir }))}
                      className="flex-1 py-1.5 px-3 rounded text-sm border transition-all"
                      style={{
                        borderColor: newAlert.direction === dir ? directionColor[dir] : 'var(--border)',
                        color: newAlert.direction === dir ? directionColor[dir] : 'var(--muted)',
                        background: newAlert.direction === dir ? `${directionColor[dir]}15` : 'transparent',
                        fontWeight: newAlert.direction === dir ? 600 : 400,
                      }}
                    >
                      {directionLabel[dir]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddAlert} disabled={!newAlert.code}>
                  <PlusIcon width="14" height="14" />
                  添加
                </Button>
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon width="14" height="14" />
              添加提醒
            </Button>
          )}

          {/* 说明 */}
          <div className="mt-6 p-3 rounded-lg text-xs" style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.03))', color: 'var(--muted)' }}>
            <p>• 每种涨跌幅每天只提醒一次，避免频繁打扰</p>
            <p>• 提醒基于实时估值数据，刷新后自动检测</p>
            <p>• 需要在浏览器中授权通知权限才能收到推送</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
