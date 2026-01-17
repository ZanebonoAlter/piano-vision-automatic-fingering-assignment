/**
 * Piano Audio Engine
 * 使用 Web Audio API 合成钢琴音色
 */

class PianoAudioEngine {
    constructor() {
        // 创建 AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        // 音符触发记录（防止重复播放）
        this.triggeredNotes = new Set();

        // 延音踏板状态
        this.sustainPedal = false;

        // 活跃的增益节点（用于踏板释音）
        this.activeGains = new Map();

        // 音色配置
        this.config = {
            masterGain: 0.3,          // 主音量
            attackTime: 0.01,         // 起音时间（秒）
            decayTime: 0.1,           // 衰减时间（秒）
            sustainLevel: 0.7,        // 延音水平
            releaseTime: 0.3,         // 释音时间（秒）
            sustainPedalReleaseTime: 2.0,  // 踏板按下时的释音时间（秒）
            harmonicStrength: 0.3     // 泛音强度
        };
    }

    /**
     * MIDI音高转频率
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * 播放单个音符
     */
    playNote(midiNote, duration = 0.5) {
        // 如果 AudioContext 被暂停，恢复它
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const frequency = this.midiToFrequency(midiNote);
        const now = this.audioContext.currentTime;
        const noteId = `${midiNote}_${now}`;

        // 创建主增益节点（控制音符音量）
        const masterGain = this.audioContext.createGain();
        masterGain.connect(this.audioContext.destination);

        // 根据踏板状态决定释音时间
        const actualReleaseTime = this.sustainPedal
            ? this.config.sustainPedalReleaseTime
            : this.config.releaseTime;

        // 设置音符的包络（ADSR）
        const { attackTime, decayTime, sustainLevel } = this.config;
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(this.config.masterGain, now + attackTime);
        masterGain.gain.linearRampToValueAtTime(this.config.masterGain * sustainLevel, now + attackTime + decayTime);
        masterGain.gain.linearRampToValueAtTime(0.01, now + duration);

        // 生成钢琴音色（基音 + 泛音）
        this.createPianoTone(frequency, masterGain, duration);

        // 自动停止
        masterGain.gain.setValueAtTime(masterGain.gain.value, now + duration);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration + actualReleaseTime);

        // 如果踏板按下,保存增益节点用于后续释音
        if (this.sustainPedal) {
            this.activeGains.set(noteId, {
                gain: masterGain,
                startTime: now,
                duration: duration
            });
        }

        setTimeout(() => {
            masterGain.disconnect();
            this.activeGains.delete(noteId);
        }, (duration + actualReleaseTime) * 1000);
    }

    /**
     * 创建钢琴音色
     */
    createPianoTone(frequency, output, duration) {
        const now = this.audioContext.currentTime;

        // 基音（正弦波 + 三角波混合）
        this.addOscillator(frequency, 'sine', 0.6, output, duration);
        this.addOscillator(frequency, 'triangle', 0.3, output, duration);

        // 泛音（增加丰富度）
        const harmonics = [2, 3, 4, 5]; // 泛音系列
        harmonics.forEach((harmonic, index) => {
            const harmonicFreq = frequency * harmonic;
            const gain = this.config.harmonicStrength / (index + 1);
            this.addOscillator(harmonicFreq, 'sine', gain, output, duration);
        });
    }

    /**
     * 添加振荡器
     */
    addOscillator(frequency, type, gain, output, duration) {
        const oscillator = this.audioContext.createOscillator();
        const oscillatorGain = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        oscillatorGain.gain.value = gain;

        oscillator.connect(oscillatorGain);
        oscillatorGain.connect(output);

        const now = this.audioContext.currentTime;
        oscillator.start(now);
        oscillator.stop(now + duration + 0.5);

        // 缓慢衰减高频泛音
        oscillatorGain.gain.setValueAtTime(gain, now);
        oscillatorGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.3);
    }

    /**
     * 播放和弦
     */
    playChord(notes, duration = 0.5) {
        notes.forEach(note => {
            this.playNote(note, duration);
        });
    }

    /**
     * 停止所有声音
     */
    stopAll() {
        this.triggeredNotes.clear();
    }

    /**
     * 设置主音量
     */
    setMasterGain(value) {
        this.config.masterGain = Math.max(0, Math.min(1, value));
    }

    /**
     * 更新音符触发记录（用于滚动模式的音符触发）
     */
    triggerNote(noteId, midiNote, duration) {
        if (!this.triggeredNotes.has(noteId)) {
            this.playNote(midiNote, duration);
            this.triggeredNotes.add(noteId);
        }
    }

    /**
     * 清除已触发的音符（用于拖动进度条时重置）
     */
    clearTriggeredNotes() {
        this.triggeredNotes.clear();
    }

    /**
     * 切换延音踏板状态
     */
    toggleSustainPedal() {
        this.sustainPedal = !this.sustainPedal;
        return this.sustainPedal;
    }

    /**
     * 设置延音踏板状态
     */
    setSustainPedal(enabled) {
        // 如果踏板从按下变为释放
        if (this.sustainPedal && !enabled) {
            this.releaseSustainedNotes();
        }
        this.sustainPedal = enabled;
    }

    /**
     * 获取延音踏板状态
     */
    getSustainPedal() {
        return this.sustainPedal;
    }

    /**
     * 释放所有延音音符
     */
    releaseSustainedNotes() {
        const now = this.audioContext.currentTime;
        this.activeGains.forEach((data, noteId) => {
            const { gain, startTime, duration } = data;

            // 快速释音
            try {
                gain.gain.cancelScheduledValues(now);
                gain.gain.setValueAtTime(gain.gain.value, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            } catch (e) {
                // 忽略调度错误
            }
        });
        this.activeGains.clear();
    }

    /**
     * 停止所有声音（包括延音）
     */
    stopAll() {
        this.triggeredNotes.clear();
        this.releaseSustainedNotes();
    }
}

// 导出（如果使用模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PianoAudioEngine;
}
