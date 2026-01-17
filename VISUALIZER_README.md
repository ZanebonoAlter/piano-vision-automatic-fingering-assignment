# Piano Fingering Visualizer - Phase 1 & 2

## 🎹 功能概述

Phase 1 实现了钢琴卷帘窗（Piano Roll）的基础可视化功能，Phase 2 添加了完整的播放控制功能，可以直观地查看和播放优化后的指法分配。

## 📁 新增文件

```
piano-vision-automatic-fingering-assignment/
├── visualizer.html          # 可视化页面（新）
├── visualizer.css           # 可视化样式（新）
├── visualizer.js            # 可视化核心逻辑（新）
├── scripts.js               # 已更新（添加可视化链接）
└── index.html               # 原有页面（不变）
```

## 🚀 使用方法

### 方法 1: 从主页面跳转

1. 打开 `index.html`
2. 上传 Piano Vision JSON 文件
3. 点击 **"📊 Open Visualizer"** 按钮
4. 自动跳转到可视化页面并显示指法

### 方法 2: 直接打开可视化页面

1. 直接打开 `visualizer.html`
2. 点击 **"Load Sample Data"** 查看示例数据
3. 或者上传自己的 JSON 文件

## ✨ Phase 1 功能清单（基础可视化）

### 核心功能 ✅

- ✅ **钢琴键盘渲染**
  - 88键完整键盘（A2-C8）
  - 白键和黑键正确显示
  - C音标记

- ✅ **音符可视化**
  - 右手音符（蓝色）
  - 左手音符（绿色）
  - 指法数字标注（1-5）
  - 音符时长显示

- ✅ **时间轴**
  - 水平时间刻度线
  - 时间标记（秒）

- ✅ **交互控制**
  - 左右手显示切换
  - 音域范围选择（全键盘/高音区/低音区）
  - 缩放控制（50%-300%）
  - 鼠标悬停显示音符详情

- ✅ **信息面板**
  - 总音符数
  - 总时长
  - 音域范围
  - 已分配指法数量

### 数据支持 ✅

- ✅ Piano Vision JSON 格式（`tracksV2`）
- ✅ 直接音符数组格式
- ✅ 内置示例数据（C大调音阶）

## ✨ Phase 2 功能清单（播放控制）

### 核心功能 ✅

- ✅ **播放控制**
  - ▶ 播放按钮
  - ⏸ 暂停按钮
  - ⏹ 停止按钮

- ✅ **进度控制**
  - 拖动进度条跳转到任意位置
  - 实时时间显示（当前/总时长）

- ✅ **速度控制**
  - 支持 0.25x - 2.0x 播放速度
  - 7档预设速度可选

- ✅ **播放线动画**
  - 红色播放线实时跟随
  - 三角形指示器标记当前位置
  - 使用独立 Canvas 层，不重绘整个画面

- ✅ **智能播放逻辑**
  - 到达末尾自动停止
  - 再次播放从头开始
  - 暂停后继续播放保持位置

### 交互改进 ✅

- ✅ 播放时播放按钮自动禁用
- ✅ 进度条实时同步
- ✅ 时间显示精确到 0.01 秒
- ✅ 高帧率动画（60fps）

## 🎨 界面说明

### 控制面板（左侧）

```
┌─────────────────────────┐
│  Controls               │
├─────────────────────────┤
│ Playback Controls:      │
│ [▶ Play] [⏸ Pause] [⏹] │
│ Speed: [1.0x ▼]         │
│                         │
│ Progress:               │
│ 0.00s / 8.00s           │
│ ━━━━━━●━━━━━━━━━━━      │
│                         │
│ Load File: [选择文件]   │
│ [Load Sample Data]      │
│                         │
│ Hand Display:           │
│ ☑ Left Hand             │
│ ☑ Right Hand            │
│                         │
│ Key Range:              │
│ [Full 88 keys ▼]        │
│                         │
│ Zoom: 50% ━━●━━ 300%    │
│                         │
│ Legend:                 │
│ ■ Right Hand            │
│ ■ Left Hand             │
└─────────────────────────┘
```

### 钢琴卷帘窗（右侧）

```
┌──────────────────────────────────────┐
│  ┌──键盘区域──┬───时间轴─────────────┐│
│  │            │                      ││
│  │  C3  C4    │  0.5s   1.0s   1.5s  ││
│  │  □  □      │  ━━━    ━━━    ━━━   ││
│  │     ◾      │                      ││
│  │  □  □      │   [3]        [1]     ││
│  │            │        [2]           ││
│  │            │  ═══播放线════════    ││ ← 红色播放线
│  └────────────┴──────────────────────┘│
│  Total Notes: 16                      │
│  Duration: 8.0s                       │
└──────────────────────────────────────┘
```

## 🔧 技术实现

### 核心类: PianoRollVisualizer

#### Phase 1 方法：
```javascript
class PianoRollVisualizer {
    constructor(containerId)        // 初始化
    loadData(data)                  // 加载数据
    loadFile(file)                  // 加载文件
    render()                        // 主渲染函数
    drawKeyboard()                  // 绘制键盘
    drawNotes()                     // 绘制音符
    drawTimeline()                  // 绘制时间轴
}
```

#### Phase 2 新增方法：
```javascript
// 播放控制
play()                             // 开始播放
pause()                            // 暂停播放
stop()                             // 停止并重置
animate()                          // 动画循环

// 渲染
drawPlayhead()                     // 绘制播放线
updateTimeDisplay()                // 更新时间显示
updateProgressSlider()             // 更新进度条
updatePlaybackButtons()            // 更新按钮状态
### 关键算法

**音符X坐标计算**:
```javascript
getNoteX(pitch) {
    // 计算黑键数量
    // 返回白键位置或黑键位置（两白键之间）
}
```

**音名获取**:
```javascript
getNoteName(midiNote) {
    // 返回 "C4", "F#5" 等格式
}
```

**Phase 2: 播放线渲染**:
```javascript
drawPlayhead() {
    // 在独立 overlay Canvas 上绘制红色播放线
    // 使用 requestAnimationFrame 实现平滑动画
    // 三角形指示器标记播放位置
}
```

**Phase 2: 时间计算**:
```javascript
animate() {
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    this.currentTime += deltaTime * this.playbackSpeed;
    // 实时更新播放线位置
}
```

## 📊 数据格式

### Piano Vision 格式

```json
{
  "tracksV2": {
    "right": [
      {
        "notes": [
          {
            "note": 60,
            "start": 0.0,
            "duration": 0.5,
            "finger": 1,
            "noteName": "C4"
          }
        ]
      }
    ],
    "left": [...]
  }
}
```

### 简化格式

```json
[
  {
    "pitch": 60,
    "time": 0.0,
    "duration": 0.5,
    "finger": 1,
    "hand": "right"
  }
]
```

## 🎯 下一步计划（Phase 3 - 可选）

- [ ] 键盘快捷键（空格播放/暂停，左右键快进快退）
- [ ] 循环播放功能
- [ ] 标记点（书签功能）
- [ ] 导出视频
- [ ] 音频播放同步
- [ ] MIDI 导出

## 🐛 已知限制

1. **缩放限制**: 仅支持时间轴缩放，不支持垂直缩放
2. **滚动**: Phase 1&2 不支持滚动，全部显示在一屏内
3. **性能**: 大型曲目（>1000音符）可能较慢
4. **音频**: Phase 2 仅可视化，不播放实际音频

## 💡 使用提示

1. **播放控制**: 点击 Play 按钮开始播放，播放线会实时移动
2. **调整速度**: 慢速（0.5x）适合学习指法，快速（1.5x）用于预览
3. **跳转位置**: 拖动进度条快速跳转到任意位置
4. **查看指法**: 将鼠标悬停在音符块上，会显示详细信息
5. **对比左右手**: 取消勾选某一只手，单独查看另一只手
6. **聚焦音域**: 选择 "Treble" 或 "Bass" 缩小显示范围
7. **调整缩放**: 使用 Zoom 滑块调整时间轴密度

## 🔗 相关链接

- [主项目 README](README.md)
- [Piano Vision](https://www.pianovision.com/)
- [pianoplayer 算法](https://github.com/marcomusy/pianoplayer/)

## 📝 更新日志

### v2.0 (Phase 2) - 2026-01-17

- ✨ 播放控制功能
- ✅ 播放/暂停/停止按钮
- ✅ 进度条拖动
- ✅ 播放速度调节（0.25x - 2.0x）
- ✅ 红色播放线动画
- ✅ 实时时间显示
- ✅ 独立 overlay Canvas 优化性能

### v1.0 (Phase 1) - 2026-01-17

- ✨ 初始版本
- ✅ 基础钢琴卷帘窗渲染
- ✅ 指法数字显示
- ✅ 左右手区分
- ✅ 交互控制面板
- ✅ 鼠标悬停提示

