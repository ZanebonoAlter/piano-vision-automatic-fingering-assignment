/**
 * Piano Fingering Visualizer - Phase 2
 * 钢琴卷帘窗可视化渲染器 + 播放控制
 */

class PianoRollVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.keyboardCanvas = document.getElementById('keyboard-canvas');
        this.notesCanvas = document.getElementById('notes-canvas');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.keyboardCtx = this.keyboardCanvas.getContext('2d');
        this.notesCtx = this.notesCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // 音符数据
        this.notesData = {
            left: [],
            right: []
        };

        // 配置参数
        this.config = {
            keyWidth: 20,          // 白键宽度（像素）
            blackKeyWidth: 12,     // 黑键宽度（像素）
            keyHeight: 80,         // 键盘高度（像素）
            pixelsPerSecond: 100,  // 每秒对应的像素数
            noteHeight: 16,        // 音符块最小高度
            minPitch: 21,          // A2 (MIDI音高)
            maxPitch: 108,         // C8 (MIDI音高)
            zoom: 1.0              // 缩放级别
        };

        // 显示状态
        this.showLeftHand = true;
        this.showRightHand = true;

        // 播放状态 (Phase 2 新增)
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.playbackSpeed = 1.0;
        this.animationId = null;
        this.lastFrameTime = 0;

        // 音频引擎 (Phase 2.5 新增)
        this.audioEngine = new PianoAudioEngine();
        this.audioEnabled = false;
        this.lastPlayedTime = 0; // 记录上次播放的时间

        this.init();
    }

    /**
     * 初始化可视化器
     */
    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.render();

        console.log('PianoRollVisualizer initialized');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 窗口大小改变
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });

        // 左手显示切换
        document.getElementById('show-left-hand').addEventListener('change', (e) => {
            this.showLeftHand = e.target.checked;
            this.render();
        });

        // 右手显示切换
        document.getElementById('show-right-hand').addEventListener('change', (e) => {
            this.showRightHand = e.target.checked;
            this.render();
        });

        // 缩放控制
        document.getElementById('zoom-slider').addEventListener('input', (e) => {
            const zoomValue = e.target.value;
            this.config.zoom = zoomValue / 100;
            document.getElementById('zoom-value').textContent = zoomValue + '%';
            this.config.pixelsPerSecond = 100 * this.config.zoom;
            this.render();
        });

        // 音域范围选择
        document.getElementById('octave-range').addEventListener('change', (e) => {
            this.setOctaveRange(e.target.value);
        });

        // 文件加载
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.loadFile(e.target.files[0]);
        });

        // 示例数据加载
        document.getElementById('load-sample-btn').addEventListener('click', () => {
            this.loadSampleData();
        });

        // ========== Phase 2: 播放控制 ==========

        // 播放按钮
        document.getElementById('play-btn').addEventListener('click', () => {
            this.play();
        });

        // 暂停按钮
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.pause();
        });

        // 停止按钮
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stop();
        });

        // 播放速度
        document.getElementById('playback-speed').addEventListener('change', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
        });

        // 进度条拖动
        document.getElementById('progress-slider').addEventListener('input', (e) => {
            const maxTime = this.getMaxTime();
            if (maxTime > 0) {
                const percent = parseFloat(e.target.value);
                this.currentTime = (percent / 100) * maxTime;
                this.updateTimeDisplay();
                // 重新绘制音符以反映新的播放位置
                this.drawNotes();
                this.drawPlayhead();
                // 清除已播放的音符记录
                this.audioEngine.clearTriggeredNotes();
                this.lastPlayedTime = this.currentTime;
            }
        });

        // 音频开关
        document.getElementById('enable-audio').addEventListener('change', (e) => {
            this.audioEnabled = e.target.checked;
            if (this.audioEnabled) {
                // 激活 AudioContext（需要用户交互）
                if (this.audioEngine.audioContext.state === 'suspended') {
                    this.audioEngine.audioContext.resume();
                }
            }
        });

        // 音量控制
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            this.audioEngine.setMasterGain(volume / 100);
        });

        // 延音踏板开关
        document.getElementById('sustain-pedal-btn').addEventListener('click', () => {
            this.toggleSustainPedal();
        });

        // 鼠标悬停显示音符信息
        this.notesCanvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.notesCanvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    /**
     * 调整Canvas尺寸
     */
    resizeCanvas() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.keyboardCanvas.width = width;
        this.keyboardCanvas.height = height;
        this.notesCanvas.width = width;
        this.notesCanvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;

        console.log(`Canvas resized: ${width}x${height}`);
    }

    // ========== Phase 2: 播放控制方法 ==========

    /**
     * 播放
     */
    play() {
        if (this.isPlaying && !this.isPaused) return;

        this.isPlaying = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();

        // 如果已经到达末尾，从头开始
        const maxTime = this.getMaxTime();
        if (this.currentTime >= maxTime) {
            this.currentTime = 0;
        }

        this.animate();
        this.updatePlaybackButtons();
    }

    /**
     * 暂停
     */
    pause() {
        if (!this.isPlaying) return;

        this.isPaused = true;
        this.isPlaying = false;
        cancelAnimationFrame(this.animationId);
        this.updatePlaybackButtons();
    }

    /**
     * 停止
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        cancelAnimationFrame(this.animationId);

        // 清除播放线
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // 清除音频触发记录
        this.audioEngine.clearTriggeredNotes();
        this.audioEngine.stopAll();  // 停止所有延音
        this.lastPlayedTime = 0;

        this.updateTimeDisplay();
        this.updatePlaybackButtons();
        this.updateProgressSlider();
    }

    /**
     * 切换延音踏板
     */
    toggleSustainPedal() {
        const isEnabled = this.audioEngine.toggleSustainPedal();
        const pedalBtn = document.getElementById('sustain-pedal-btn');

        if (isEnabled) {
            pedalBtn.textContent = '🎯 Sustain Pedal: ON';
            pedalBtn.classList.add('active');
        } else {
            pedalBtn.textContent = '🎯 Sustain Pedal: OFF';
            pedalBtn.classList.remove('active');
        }

        console.log(`Sustain pedal ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 动画循环
     */
    animate() {
        if (!this.isPlaying) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // 转换为秒
        this.lastFrameTime = currentTime;

        // 更新播放时间
        const previousTime = this.currentTime;
        this.currentTime += deltaTime * this.playbackSpeed;

        // 检查是否播放完毕
        const maxTime = this.getMaxTime();
        if (this.currentTime >= maxTime) {
            this.currentTime = maxTime;
            this.stop();
            return;
        }

        // 触发音频（如果启用）
        if (this.audioEnabled) {
            this.triggerAudio();
        }

        // 重新绘制音符和时间轴（实现滚动效果）
        this.drawNotes();

        // 绘制播放线（固定在键盘位置）
        this.drawPlayhead();

        // 更新显示
        this.updateTimeDisplay();
        this.updateProgressSlider();

        // 继续动画
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * 绘制播放线（固定在键盘位置）
     */
    drawPlayhead() {
        const ctx = this.overlayCtx;
        const { keyHeight } = this.config;

        // 清空覆盖层
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // 播放线固定在键盘底部（y = keyHeight）
        const y = keyHeight;

        // 绘制红色播放线
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.overlayCanvas.width, y);
        ctx.stroke();

        // 绘制播放线顶部的三角形指示器（提示这是按键位置）
        ctx.fillStyle = '#e74c3c';
        for (let x = 0; x < this.overlayCanvas.width; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 10, y - 10);
            ctx.lineTo(x + 20, y);
            ctx.closePath();
            ctx.fill();
        }
    }

    /**
     * 触发音频（播放到达播放线的音符）
     */
    triggerAudio() {
        const allNotes = [
            ...(this.showLeftHand ? this.notesData.left : []),
            ...(this.showRightHand ? this.notesData.right : [])
        ];

        allNotes.forEach(note => {
            // 检查音符是否在当前时间窗口内（到达播放线）
            // 使用小的时间窗口确保不会遗漏
            const timeWindow = 0.05; // 50ms窗口
            if (note.time >= this.lastPlayedTime && note.time < this.currentTime + timeWindow) {
                // 创建唯一的音符ID（音高 + 开始时间）
                const noteId = `${note.pitch}_${note.time}`;
                this.audioEngine.triggerNote(noteId, note.pitch, note.duration);
            }
        });

        // 更新上次播放时间
        this.lastPlayedTime = this.currentTime;
    }

    /**
     * 更新时间显示
     */
    updateTimeDisplay() {
        const currentTime = this.currentTime.toFixed(2);
        const maxTime = this.getMaxTime().toFixed(2);
        document.getElementById('current-time-display').textContent = currentTime;
        document.getElementById('total-time-display').textContent = maxTime;
    }

    /**
     * 更新进度条
     */
    updateProgressSlider() {
        const maxTime = this.getMaxTime();
        if (maxTime > 0) {
            const percent = (this.currentTime / maxTime) * 100;
            document.getElementById('progress-slider').value = percent;
        }
    }

    /**
     * 更新播放按钮状态
     */
    updatePlaybackButtons() {
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');

        if (this.isPlaying) {
            playBtn.disabled = true;
            pauseBtn.disabled = false;
        } else if (this.isPaused) {
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        } else {
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }

    /**
     * 设置音域范围
     */
    setOctaveRange(range) {
        switch(range) {
            case 'treble': // C4-B5
                this.config.minPitch = 48;  // C3
                this.config.maxPitch = 83;  // B5
                break;
            case 'bass': // A2-C4
                this.config.minPitch = 21;  // A2
                this.config.maxPitch = 60;  // C4
                break;
            case 'full':
            default:
                this.config.minPitch = 21;  // A2
                this.config.maxPitch = 108; // C8
        }
        this.render();
    }

    /**
     * 加载JSON文件
     */
    async loadFile(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            this.loadData(data);
        } catch (error) {
            alert('Error loading file: ' + error.message);
        }
    }

    /**
     * 加载数据到可视化器
     */
    loadData(data) {
        this.notesData = {
            left: [],
            right: []
        };

        // 检查是否是Piano Vision格式
        if (data.tracksV2) {
            // 提取左右手音符
            ['left', 'right'].forEach(hand => {
                if (Array.isArray(data.tracksV2[hand])) {
                    data.tracksV2[hand].forEach(block => {
                        if (Array.isArray(block.notes)) {
                            block.notes.forEach(note => {
                                this.notesData[hand].push({
                                    pitch: note.note,
                                    time: note.start || note.time,
                                    duration: note.duration || 0,
                                    finger: note.finger || 0,
                                    isBlack: this.isBlackKey(note.note % 12),
                                    noteName: note.noteName || ''
                                });
                            });
                        }
                    });
                }
            });
        } else if (Array.isArray(data)) {
            // 直接的音符数组格式
            data.forEach(note => {
                const hand = note.hand || 'right';
                this.notesData[hand].push({
                    pitch: note.pitch || note.note,
                    time: note.time,
                    duration: note.duration || 0,
                    finger: note.finger || 0,
                    isBlack: this.isBlackKey((note.pitch || note.note) % 12),
                    noteName: note.noteName || ''
                });
            });
        }

        this.updateInfoPanel();
        this.render();

        console.log(`Loaded ${this.notesData.left.length} left hand notes, ${this.notesData.right.length} right hand notes`);
    }

    /**
     * 加载示例数据
     */
    loadSampleData() {
        const sampleData = this.generateSampleData();
        this.loadData(sampleData);
    }

    /**
     * 生成示例数据（包含黑键的练习曲）
     */
    generateSampleData() {
        const notes = {
            left: [],
            right: []
        };

        // 右手：包含黑键的旋律
        const rightHandNotes = [
            { pitch: 60, duration: 0.5, finger: 1 },  // C4 (白键)
            { pitch: 62, duration: 0.5, finger: 2 },  // D4 (白键)
            { pitch: 64, duration: 0.5, finger: 3 },  // E4 (白键)
            { pitch: 65, duration: 0.5, finger: 1 },  // F4 (白键)
            { pitch: 67, duration: 0.5, finger: 2 },  // G4 (白键)
            { pitch: 66, duration: 0.5, finger: 3 },  // F#4 (黑键)
            { pitch: 65, duration: 0.5, finger: 1 },  // F4 (白键)
            { pitch: 64, duration: 0.5, finger: 4 },  // E4 (白键)
            { pitch: 62, duration: 0.5, finger: 3 },  // D4 (白键)
            { pitch: 61, duration: 0.5, finger: 2 },  // C#4 (黑键)
            { pitch: 60, duration: 0.5, finger: 1 },  // C4 (白键)
            { pitch: 62, duration: 0.5, finger: 2 },  // D4 (白键)
            { pitch: 64, duration: 0.5, finger: 3 },  // E4 (白键)
            { pitch: 66, duration: 0.5, finger: 4 },  // F#4 (黑键)
            { pitch: 68, duration: 0.5, finger: 5 },  // G#4 (黑键)
            { pitch: 69, duration: 0.5, finger: 4 },  // A4 (白键)
            { pitch: 71, duration: 0.0, finger: 5 },  // B4 (白键)
            { pitch: 72, duration: 1.0, finger: 5 },  // C5 (白键)
        ];

        let time = 0;
        rightHandNotes.forEach(n => {
            notes.right.push({
                pitch: n.pitch,
                time: time,
                duration: n.duration,
                finger: n.finger,
                isBlack: this.isBlackKey(n.pitch % 12),
                noteName: this.getNoteName(n.pitch)
            });
            time += n.duration;
        });

        // 左手：包含黑键的伴奏
        const leftHandNotes = [
            { pitch: 48, duration: 1.0, finger: 5 },  // C3 (白键)
            { pitch: 50, duration: 1.0, finger: 4 },  // D3 (白键)
            { pitch: 52, duration: 1.0, finger: 3 },  // E3 (白键)
            { pitch: 53, duration: 1.0, finger: 2 },  // F3 (白键)
            { pitch: 55, duration: 1.0, finger: 1 },  // G3 (白键)
            { pitch: 54, duration: 1.0, finger: 2 },  // F#3 (黑键)
            { pitch: 53, duration: 1.0, finger: 3 },  // F3 (白键)
            { pitch: 52, duration: 1.0, finger: 4 },  // E3 (白键)
            { pitch: 50, duration: 1.0, finger: 5 },  // D3 (白键)
            { pitch: 49, duration: 1.0, finger: 4 },  // C#3 (黑键)
            { pitch: 48, duration: 2.0, finger: 5 },  // C3 (白键)
        ];

        time = 0;
        leftHandNotes.forEach(n => {
            notes.left.push({
                pitch: n.pitch,
                time: time,
                duration: n.duration,
                finger: n.finger,
                isBlack: this.isBlackKey(n.pitch % 12),
                noteName: this.getNoteName(n.pitch)
            });
            time += n.duration;
        });

        return notes;
    }

    /**
     * 更新信息面板
     */
    updateInfoPanel() {
        const totalNotes = this.notesData.left.length + this.notesData.right.length;
        const maxTime = this.getMaxTime();

        // 计算音域范围
        const allPitches = [
            ...this.notesData.left.map(n => n.pitch),
            ...this.notesData.right.map(n => n.pitch)
        ];
        const minPitch = allPitches.length > 0 ? Math.min(...allPitches) : 0;
        const maxPitch = allPitches.length > 0 ? Math.max(...allPitches) : 0;

        // 计算已分配指法数量
        const assignedFingerings = [
            ...this.notesData.left,
            ...this.notesData.right
        ].filter(n => n.finger > 0).length;

        document.getElementById('total-notes').textContent = totalNotes;
        document.getElementById('total-duration').textContent = maxTime.toFixed(1) + 's';
        document.getElementById('pitch-range').textContent =
            `${this.getNoteName(minPitch)} - ${this.getNoteName(maxPitch)}`;
        document.getElementById('assigned-fingerings').textContent = assignedFingerings;

        // Phase 2: 更新播放控制面板的总时间
        this.updateTimeDisplay();
        this.updateProgressSlider();
    }

    /**
     * 获取最大时间
     */
    getMaxTime() {
        const allNotes = [...this.notesData.left, ...this.notesData.right];
        return allNotes.length > 0 ?
            Math.max(...allNotes.map(n => n.time + n.duration)) : 0;
    }

    /**
     * 判断是否是黑键
     */
    isBlackKey(midiNote) {
        const pc = midiNote % 12;
        return [1, 3, 6, 8, 10].includes(pc);
    }

    /**
     * 获取音名
     */
    getNoteName(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return noteName + octave;
    }

    /**
     * 计算音符的X坐标
     */
    getNoteX(pitch) {
        // 计算在该音高之前有多少个黑键
        let blackKeysBefore = 0;
        for (let p = this.config.minPitch; p < pitch; p++) {
            if (this.isBlackKey(p)) blackKeysBefore++;
        }

        // 计算白键索引
        const whiteKeyIndex = (pitch - this.config.minPitch) - blackKeysBefore;

        if (this.isBlackKey(pitch)) {
            // 黑键位置：位于两个白键之间
            return (whiteKeyIndex * this.config.keyWidth) -
                   (this.config.blackKeyWidth / 2);
        } else {
            // 白键位置
            return whiteKeyIndex * this.config.keyWidth;
        }
    }

    /**
     * 渲染钢琴键盘
     */
    drawKeyboard() {
        const ctx = this.keyboardCtx;
        const { keyWidth, blackKeyWidth, keyHeight, minPitch, maxPitch } = this.config;

        // 清空画布
        ctx.clearRect(0, 0, this.keyboardCanvas.width, this.keyboardCanvas.height);

        // 绘制白键
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 1;

        for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
            if (!this.isBlackKey(pitch)) {
                const x = this.getNoteX(pitch);

                // 白键背景
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x, 0, keyWidth, keyHeight);

                // 白键边框
                ctx.strokeRect(x, 0, keyWidth, keyHeight);

                // 标注C音
                if (pitch % 12 === 0) {
                    ctx.fillStyle = '#cccccc';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('C' + Math.floor(pitch / 12 - 1), x + keyWidth / 2, keyHeight - 8);
                }
            }
        }

        // 绘制黑键
        for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
            if (this.isBlackKey(pitch)) {
                const x = this.getNoteX(pitch);

                // 黑键背景
                ctx.fillStyle = '#333333';
                ctx.fillRect(x, 0, blackKeyWidth, keyHeight * 0.65);

                // 黑键边框
                ctx.strokeStyle = '#000000';
                ctx.strokeRect(x, 0, blackKeyWidth, keyHeight * 0.65);
            }
        }

        // 绘制键盘边框
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.getTotalWidth(), keyHeight);
    }

    /**
     * 渲染所有音符
     */
    drawNotes() {
        const ctx = this.notesCtx;
        const { keyHeight, pixelsPerSecond } = this.config;

        // 清空画布
        ctx.clearRect(0, 0, this.notesCanvas.width, this.notesCanvas.height);

        // 绘制右手音符
        if (this.showRightHand) {
            this.drawHandNotes(this.notesData.right, '#3498db', 'Right Hand');
        }

        // 绘制左手音符
        if (this.showLeftHand) {
            this.drawHandNotes(this.notesData.left, '#2ecc71', 'Left Hand');
        }
    }

    /**
     * 渲染单手音符（支持滚动模式）
     */
    drawHandNotes(notes, color, handName) {
        const ctx = this.notesCtx;
        const { noteHeight, keyHeight, pixelsPerSecond, blackKeyWidth, keyWidth } = this.config;

        notes.forEach(note => {
            const x = this.getNoteX(note.pitch);

            // 关键修改：Y坐标减去当前播放时间，实现滚动效果
            // 当 note.time == currentTime 时，y = keyHeight（刚好到达键盘）
            const y = keyHeight + ((note.time - this.currentTime) * pixelsPerSecond);

            const width = note.isBlack ? blackKeyWidth : keyWidth;
            const height = Math.max(note.duration * pixelsPerSecond, noteHeight);

            // 性能优化：只绘制在可见区域内的音符
            const canvasHeight = this.notesCanvas.height;
            if (y + height < 0 || y > canvasHeight) {
                return; // 音符不在可见区域内，跳过
            }

            // 为黑键音符使用更深的颜色
            let noteColor = color;
            if (note.isBlack) {
                // 黑键音符：加深颜色 40%
                noteColor = this.darkenColor(color, 40);
            }

            // 绘制音符块
            ctx.fillStyle = noteColor;
            ctx.fillRect(x, y, width - 1, height);

            // 绘制边框（黑键使用更深的边框）
            let borderColor = this.darkenColor(color, 20);
            if (note.isBlack) {
                borderColor = this.darkenColor(noteColor, 30);
            }
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, width - 1, height);

            // 绘制指法数字
            if (note.finger > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // 如果音符块太短，将数字放在上方
                if (height < 16) {
                    ctx.fillText(note.finger, x + width / 2, y - 8);
                } else {
                    ctx.fillText(note.finger, x + width / 2, y + height / 2);
                }
            }
        });
    }

    /**
     * 渲染时间轴（支持滚动模式）
     */
    drawTimeline() {
        const ctx = this.notesCtx;
        const { keyHeight, pixelsPerSecond } = this.config;
        const maxTime = this.getMaxTime();
        const canvasHeight = this.notesCanvas.height;

        // 时间轴背景线
        ctx.strokeStyle = '#eeeeee';
        ctx.lineWidth = 1;

        for (let t = 0; t <= maxTime; t += 0.5) {
            // 关键修改：时间线也跟随滚动
            const y = keyHeight + ((t - this.currentTime) * pixelsPerSecond);

            // 性能优化：只绘制可见区域内的线
            if (y < keyHeight || y > canvasHeight) {
                continue;
            }

            // 绘制水平线
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.notesCanvas.width, y);
            ctx.stroke();

            // 绘制时间标签
            ctx.fillStyle = '#999999';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(t.toFixed(1) + 's', 10, y - 3);
        }
    }

    /**
     * 计算键盘总宽度
     */
    getTotalWidth() {
        let whiteKeyCount = 0;
        for (let p = this.config.minPitch; p <= this.config.maxPitch; p++) {
            if (!this.isBlackKey(p)) whiteKeyCount++;
        }
        return whiteKeyCount * this.config.keyWidth;
    }

    /**
     * 主渲染函数
     */
    render() {
        this.drawKeyboard();
        this.drawTimeline();
        this.drawNotes();
    }

    /**
     * 处理鼠标移动（显示tooltip）
     */
    handleMouseMove(e) {
        const rect = this.notesCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const { keyHeight } = this.config;

        // 检查是否在音符区域
        if (y < keyHeight) {
            this.hideTooltip();
            return;
        }

        // 查找鼠标位置的音符
        const time = (y - keyHeight) / this.config.pixelsPerSecond;

        const allNotes = [
            ...(this.showLeftHand ? this.notesData.left.map(n => ({...n, hand: 'Left'})) : []),
            ...(this.showRightHand ? this.notesData.right.map(n => ({...n, hand: 'Right'})) : [])
        ];

        const foundNote = allNotes.find(note => {
            return time >= note.time && time <= note.time + note.duration;
        });

        if (foundNote) {
            const noteX = this.getNoteX(foundNote.pitch);
            const width = foundNote.isBlack ? this.config.blackKeyWidth : this.config.keyWidth;

            if (x >= noteX && x <= noteX + width) {
                this.showTooltip(e.clientX, e.clientY, foundNote);
                return;
            }
        }

        this.hideTooltip();
    }

    /**
     * 显示tooltip
     */
    showTooltip(x, y, note) {
        const tooltip = document.getElementById('tooltip');
        tooltip.innerHTML = `
            <div class="note-info">🎵 ${note.noteName || this.getNoteName(note.pitch)}</div>
            <div class="note-info">✋ ${note.hand} Hand</div>
            <div class="note-info">⏱️ ${note.time.toFixed(2)}s - ${(note.time + note.duration).toFixed(2)}s</div>
            <div class="note-info">👆 Finger: <span class="finger-number">${note.finger || '?'}</span></div>
        `;

        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
        tooltip.classList.add('visible');
    }

    /**
     * 隐藏tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.classList.remove('visible');
    }

    /**
     * 颜色变暗工具函数
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new PianoRollVisualizer('piano-roll-container');

    // 尝试从 sessionStorage 加载数据
    const storedData = sessionStorage.getItem('pianoVisionData');
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            visualizer.loadData(data);
            console.log('Loaded data from sessionStorage');
            // 清除 sessionStorage 以避免占用过多空间
            sessionStorage.removeItem('pianoVisionData');
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    console.log('Piano Fingering Visualizer loaded!');
});
