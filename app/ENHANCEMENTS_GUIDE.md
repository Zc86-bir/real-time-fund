# 前端美化增强指南

## 概述

`enhancements.css` 提供了丰富的美化效果，包括动效、光影、微交互等。

## 快速使用

### 1. 卡片悬浮效果

```jsx
// 基础悬浮效果
<div className="glass card-hover">
  <h3>基金名称</h3>
  <p>估值信息</p>
</div>

// 带光泽效果
<div className="glass card-hover card-shine">
  <h3>基金名称</h3>
</div>
```

### 2. 按钮增强

```jsx
// 脉冲发光按钮
<button className="button button-pulse">立即添加</button>

// 涟漪效果图标按钮
<button className="icon-button icon-button-ripple">
  <RefreshIcon />
</button>

// 幽灵按钮
<button className="button-ghost">取消</button>
```

### 3. 入场动画

```jsx
// 淡入动画（自动应用于 .content 下的子元素）
<div className="content">
  <div>元素1 - 延迟0.05s</div>
  <div>元素2 - 延迟0.1s</div>
  <div>元素3 - 延迟0.15s</div>
</div>

// 单独使用动画
<div className="modal-enter">
  <ModalContent />
</div>
```

### 4. 表格增强

```jsx
// 增强表格行
<div className="table-row-enhanced">
  <span>基金代码</span>
  <span>估值</span>
</div>

// 带发光的表头
<div className="table-header-glow">
  <span>表头</span>
</div>
```

### 5. 徽章标签

```jsx
// 渐变徽章
<span className="badge badge-gradient">热门</span>

// 状态徽章（带脉冲点）
<span className="badge badge-status" style={{ color: 'var(--success)' }}>
  运行中
</span>
```

### 6. 输入框增强

```jsx
// 发光聚焦效果
<input className="input input-glow" placeholder="搜索基金..." />

// 搜索框动画
<input className="input search-input-animated" />
```

### 7. 数值动画

```jsx
// 数值变化动画
<span className={isUp ? 'value-up' : isDown ? 'value-down' : ''}>
  {value}
</span>

// 数值更新闪烁
<span className="value-flash">{value}</span>
```

### 8. 工具提示

```jsx
// 添加 data-tooltip 属性
<button className="tooltip" data-tooltip="刷新数据">
  <RefreshIcon />
</button>
```

### 9. 玻璃拟态

```jsx
// 强烈玻璃效果
<div className="glass-strong">
  <h2>重要信息</h2>
</div>

// 柔和玻璃效果
<div className="glass-subtle">
  <p>辅助内容</p>
</div>
```

### 10. 文字效果

```jsx
// 渐变文字
<h1 className="text-gradient">基估宝</h1>
```

### 11. 标签悬浮效果

```jsx
// 给 shadcn Badge 组件添加悬浮效果
<Badge className="badge-hover">标签名称</Badge>
```

### 12. 关联板块徽章

```jsx
// 关联板块美化样式
<span className="related-sector-badge">板块名称</span>
```

### 13. 滚动条美化

```jsx
// 美化滚动条
<div className="scrollbar-beautiful" style={{ overflow: 'auto', maxHeight: '400px' }}>
  {/* 长内容 */}
</div>
```

### 12. 骨架屏

```jsx
// 加载骨架屏
<div className="skeleton" style={{ width: '200px', height: '20px' }} />
```

### 13. 空状态

```jsx
// 空状态装饰
<div className="empty-state">
  <div className="empty-state-icon">📊</div>
  <p>暂无数据</p>
</div>
```

### 14. 悬停效果

```jsx
// 悬停缩放
<div className="hover-scale">
  <img src="fund-icon.png" />
</div>

// 悬停提升
<div className="hover-lift">
  <Card />
</div>
```

### 15. 选中状态

```jsx
// 选中发光
<div className={`card ${isSelected ? 'selected-glow' : ''}`}>
  内容
</div>
```

## 动画类列表

| 类名 | 效果 |
|------|------|
| `fadeIn` | 淡入上移动画 |
| `fadeInScale` | 淡入缩放动画 |
| `slideInLeft` | 左侧滑入 |
| `slideInRight` | 右侧滑入 |
| `modal-enter` | 模态框入场 |
| `drawer-enter-left` | 抽屉左侧滑入 |
| `drawer-enter-right` | 抽屉右侧滑入 |
| `value-up` | 数值上涨动画 |
| `value-down` | 数值下跌动画 |
| `value-flash` | 数值闪烁 |
| `float` | 悬浮动画 |
| `pulse-glow` | 脉冲发光 |
| `spin` | 旋转动画 |

## 组合使用示例

```jsx
// 一个美观的基金卡片
<div className="glass card-hover card-shine">
  <div className="flex items-center gap-3">
    <div className="badge badge-gradient">热门</div>
    <h3 className="text-gradient"> fund.name </h3>
  </div>
  
  <div className="mt-4 flex items-center justify-between">
    <span className={fund.gszzl > 0 ? 'value-up up' : 'value-down down'}>
      {fund.gszzl}%
    </span>
    
    <button className="icon-button icon-button-ripple tooltip" 
            data-tooltip="查看详情">
      <EyeIcon />
    </button>
  </div>
</div>
```

## 注意事项

1. **性能优化**：动画元素不要过多，避免重排重绘
2. **可访问性**：提供 `prefers-reduced-motion` 支持
3. **暗色/亮色主题**：所有效果都适配双主题
4. **移动端**：部分效果在移动端会自动简化

## 自定义

可以通过 CSS 变量调整效果：

```css
:root {
  --animation-duration: 0.3s;
  --hover-lift-distance: 4px;
  --glow-intensity: 0.5;
}
```
