'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 数据源配置
const SOURCES = [
  {
    id: 'sina',
    name: '新浪快讯',
    type: 'jsonp',
    url: 'https://feed.mix.sina.com.cn/api/roll/get',
    params: { pageid: '153', lid: '2516', k: '', num: '20', page: '1' },
  },
  {
    id: '36kr',
    name: '36氪',
    type: 'rss',
    feedUrl: 'https://36kr.com/feed',
  },
  {
    id: 'ithome',
    name: 'IT之家',
    type: 'rss',
    feedUrl: 'https://www.ithome.com/rss/',
  },
];

// RSS 代理
const RSS_PROXIES = [
  'https://feed2json.org/convert?url=',
  'https://api.rss2json.com/v1/api.json?rss_url=',
];

/**
 * 财经快讯组件
 * 整合多数据源：新浪 7×24 快讯 + RSS 新闻
 * 使用 JSONP 和 RSS-to-JSON 代理绕过 CORS
 */
export default function Jin10FlashNews({ limit = 15, className = '' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [source, setSource] = useState('all');
  const callbackRef = useRef(0);
  const currentSourceRef = useRef(0);

  const fetchJsonp = useCallback(async (sourceConfig) => {
    const callbackId = ++callbackRef.current;
    const callbackName = `sina_cb_${callbackId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      window[callbackName] = (response) => {
        cleanup();
        resolve(response);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('新浪快讯请求超时'));
      }, 8000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        const el = document.getElementById(callbackName);
        if (el) el.remove();
      }

      const params = new URLSearchParams({
        ...sourceConfig.params,
        callback: callbackName,
      });

      const script = document.createElement('script');
      script.id = callbackName;
      script.type = 'text/javascript';
      script.src = `${sourceConfig.url}?${params}`;
      script.onerror = () => {
        cleanup();
        reject(new Error('新浪快讯加载失败'));
      };
      document.head.appendChild(script);
    });
  }, []);

  const fetchRss = useCallback(async (feedUrl) => {
    for (const proxy of RSS_PROXIES) {
      try {
        const proxyUrl = `${proxy}${encodeURIComponent(feedUrl)}`;
        const res = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = await res.json();

        // feed2json.org: { items: [...] }
        // rss2json.com: { status: 'ok', items: [...] }
        const list = data.items || data.entries || [];
        if (list.length > 0) return list;
      } catch {
        continue;
      }
    }
    throw new Error('RSS 代理均不可用');
  }, []);

  const parseSinaItem = (item, sourceId) => ({
    id: item.docid || `sina_${Date.now()}`,
    title: item.title || item.intro || '',
    content: item.title || item.intro || '',
    time: item.ctime ? new Date(item.ctime * 1000).toISOString() : '',
    url: item.url || '',
    source: sourceId,
    important: parseInt(item.level || '0') >= 2,
  });

  const parseRssItem = (item, sourceId) => {
    const pubDate = item.published || item.pubDate || item.date || '';
    return {
      id: item.id || item.guid || `rss_${Date.now()}`,
      title: item.title || '',
      content: item.title || item.summary || item.description || '',
      time: pubDate ? new Date(pubDate).toISOString() : '',
      url: item.url || item.link || item.href || '',
      source: sourceId,
      important: false,
    };
  };

  const fetchNews = useCallback(async () => {
    const runId = ++currentSourceRef.current;

    try {
      setLoading(true);
      setError(null);

      // 并行获取所有数据源
      const fetchPromises = SOURCES.map(async (sourceConfig) => {
        try {
          if (sourceConfig.type === 'jsonp') {
            const data = await fetchJsonp(sourceConfig);
            const list = data?.result?.data || [];
            return list.map(item => parseSinaItem(item, sourceConfig.id));
          } else if (sourceConfig.type === 'rss') {
            const list = await fetchRss(sourceConfig.feedUrl);
            return list.slice(0, 10).map(item => parseRssItem(item, sourceConfig.id));
          }
        } catch (e) {
          console.warn(`[快讯] ${sourceConfig.name} 获取失败:`, e.message);
          return [];
        }
        return [];
      });

      const results = await Promise.all(fetchPromises);

      // 检查是否被新的请求覆盖
      if (runId !== currentSourceRef.current) return;

      // 合并去重（按 title 去重）
      const seen = new Set();
      const merged = results
        .flat()
        .filter(item => {
          if (!item.content) return false;
          if (seen.has(item.content)) return false;
          seen.add(item.content);
          return true;
        })
        // 按时间排序
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, limit);

      setItems(merged);
      setLastUpdate(new Date());
      setSource('all');
    } catch (e) {
      if (runId !== currentSourceRef.current) return;
      console.warn('[快讯] 获取失败:', e.message);
      setError(`获取快讯失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [limit, fetchJsonp, fetchRss]);

  const switchSource = useCallback((sourceId) => {
    setSource(sourceId);
    setLoading(true);
    setError(null);

    if (sourceId === 'all') {
      fetchNews();
      return;
    }

    // 单源模式：过滤已加载数据
    const filtered = sourceId === 'local'
      ? items.slice(0, limit)
      : items.filter(i => i.source === sourceId).slice(0, limit);

    if (filtered.length > 0) {
      setItems(filtered);
      setLoading(false);
    } else {
      // 如果没有缓存，重新获取该源
      const sourceConfig = SOURCES.find(s => s.id === sourceId);
      if (sourceConfig) {
        (async () => {
          try {
            let result;
            if (sourceConfig.type === 'jsonp') {
              const data = await fetchJsonp(sourceConfig);
              const list = data?.result?.data || [];
              result = list.map(item => parseSinaItem(item, sourceConfig.id));
            } else {
              const list = await fetchRss(sourceConfig.feedUrl);
              result = list.slice(0, limit).map(item => parseRssItem(item, sourceConfig.id));
            }
            setItems(result);
            setSource(sourceId);
          } catch (e) {
            setError(`获取 ${sourceConfig.name} 失败: ${e.message}`);
          } finally {
            setLoading(false);
          }
        })();
      }
    }
  }, [items, limit, fetchJsonp, fetchRss, fetchNews]);

  useEffect(() => {
    fetchNews();
    const timer = setInterval(fetchNews, 60000);
    return () => clearInterval(timer);
  }, [fetchNews]);

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getSourceLabel = (sourceId) => {
    const map = { sina: '新浪', '36kr': '36氪', ithome: 'IT之家', sspai: '少数派', all: '全部' };
    return map[sourceId] || sourceId;
  };

  if (loading && items.length === 0) {
    return (
      <div className={`jin10-news ${className}`}>
        <div className="jin10-header">
          <span style={{ fontSize: 18 }}>⚡</span>
          <span className="jin10-title">财经快讯</span>
          <span className="muted" style={{ fontSize: 12 }}>加载中...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="jin10-item jin10-skeleton">
            <div style={{ width: 45, height: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 4, flexShrink: 0 }} />
            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`jin10-news jin10-error ${className}`}>
        <div className="jin10-header">
          <span style={{ fontSize: 18 }}>⚡</span>
          <span className="jin10-title">财经快讯</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', padding: '8px 0' }}>{error}</div>
        <button className="jin10-retry-btn" onClick={fetchNews}>重试</button>
      </div>
    );
  }

  return (
    <div className={`jin10-news ${className}`}>
      <div className="jin10-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span className="jin10-title">财经快讯</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
            ({getSourceLabel(source)})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {lastUpdate && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {/* 源切换按钮 */}
          {SOURCES.map(s => (
            <button
              key={s.id}
              onClick={() => switchSource(s.id)}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
                background: source === s.id ? 'rgba(34,211,238,0.15)' : 'transparent',
                color: source === s.id ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={s.name}
            >
              {s.name.replace('快讯', '').replace('36氪', '36氪').slice(0, 3)}
            </button>
          ))}
          <button
            className="jin10-refresh-btn"
            onClick={fetchNews}
            disabled={loading}
            title={loading ? '刷新中...' : '刷新'}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      <div className="jin10-list">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.a
              key={item.id || index}
              href={item.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="jin10-item"
            >
              <span className="jin10-time">{formatTime(item.time)}</span>
              <span className="jin10-content">
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--primary)',
                    marginRight: 4,
                    opacity: 0.7,
                  }}
                >
                  [{getSourceLabel(item.source)}]
                </span>
                {item.content}
              </span>
              {item.important && <span className="jin10-important">重</span>}
            </motion.a>
          ))}
        </AnimatePresence>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          暂无快讯数据
        </div>
      )}
    </div>
  );
}
