// Fingering assignment algorithm ported from pianoplayer
// https://github.com/marcomusy/pianoplayer/

// Constants and configurations
const fingers = [1, 2, 3, 4, 5];
const handSizes = {
    'XXS': 0.80,
    'XS': 0.85,
    'S': 0.90,
    'M': 1.00,
    'L': 1.05,
    'XL': 1.10,
    'XXL': 1.15
};

/**
 * 镜像转换左手指法
 * 左手的指法编号需要镜像：1↔5, 2↔4, 3保持不变
 * 因为左手和右手在钢琴上的位置是相反的
 */
function mirrorLeftHandFinger(finger) {
    const mirrorMap = {
        1: 5,
        2: 4,
        3: 3,
        4: 2,
        5: 1
    };
    return mirrorMap[finger] || finger;
}

class Note {
    constructor(data) {
        // Extract necessary properties from the note data
        this.name = data.noteName || data.notePitch || '';
        this.isChord = data.isChord || false;
        this.isBlack = isBlackKey(data.note % 12);
        this.pitch = data.note;
        this.octave = data.octave || Math.floor(data.note / 12) - 1;
        this.x = keyPosition(this.pitch);
        this.time = data.start || data.time || 0;
        this.duration = data.duration || 0;
        this.fingering = data.finger || 0;
        this.measure = data.measure || 0;
        this.chordId = data.chordID || 0;
        this.chordNr = data.chordnr || 0;
        this.nInChord = data.NinChord || 0;
        this.noteId = data.id || 0;
        this.data = data; // Reference to the original data object
    }
}

class Hand {
    constructor(noteseq, side = 'right', size = 'M') {
        this.side = side;
        this.frest = [null, -7.0, -2.8, 0.0, 2.8, 5.6]; // Finger positions at rest (cm)
        this.weights = [null, 1.1, 1.0, 1.1, 0.9, 0.8]; // Finger relative strength
        this.bfactor = [null, 0.3, 1.0, 1.1, 0.8, 0.7]; // Bias for black keys
        this.noteseq = noteseq; // Array of Note objects
        this.fingerseq = [];
        this.depth = 9;
        this.autodepth = true;
        this.size = size;
        this.hf = handSizes[size];
        for (let i = 1; i <= 5; i++) {
            if (this.frest[i]) this.frest[i] *= this.hf;
        }
        this.cfps = [...this.frest]; // Current finger positions
        this.cost = -1;
    }

    setFingerPositions(fings, notes, i) {
        const fi = fings[i];
        const ni = notes[i];
        const ifx = this.frest[fi];
        if (ifx !== null && ni) {
            for (let j = 1; j <= 5; j++) {
                const jfx = this.frest[j];
                this.cfps[j] = (jfx - ifx) + ni.x;
            }
        }
    }

    averageVelocity(fingering, notes) {
        this.setFingerPositions(fingering, notes, 0); // Initialize finger positions
        let vmean = 0;
        for (let i = 1; i < fingering.length; i++) {
            const na = notes[i - 1];
            const nb = notes[i];
            const fb = fingering[i];
            if (!na || !nb || !fb) continue; // Prevent accessing undefined
            const dx = Math.abs(nb.x - this.cfps[fb]); // Distance traveled by finger fb
            const dt = Math.abs(nb.time - na.time) + 0.1; // Available time + smoothing term
            let v = dx / dt; // Velocity
            if (nb.isBlack) {
                v /= this.weights[fb] * this.bfactor[fb];
            } else {
                v /= this.weights[fb];
            }
            vmean += v;
            this.setFingerPositions(fingering, notes, i); // Update finger positions
        }
        return vmean / (fingering.length - 1);
    }

    skip(fa, fb, na, nb, level) {
        if (!na || !nb) return true;
        const xba = nb.x - na.x; // Distance between notes
        // Simplified skip rules
        if (!na.isChord && !nb.isChord) {
            if (fa === fb && xba && na.duration < 4) return true;
            if (fa > 1) {
                if (fb > 1 && (fb - fa) * xba < 0) return true;
                if (fb === 1 && nb.isBlack && xba > 0) return true;
            } else {
                if (na.isBlack && xba < 0 && fb > 1 && na.duration < 2) return true;
            }
        }
        return false;
    }

    optimizeSeq(nseq, istart) {
        const depth = Math.min(this.depth, nseq.length);
        const fingers = [1, 2, 3, 4, 5];
        const u_start = istart ? [istart] : fingers;
        let out = { fingering: Array(depth).fill(0), velocity: -1 };
        let minvel = 1e10;

        // Generate all possible fingering combinations recursively
        const generateFingerings = (level, currentFingering) => {
            if (level === depth) {
                const v = this.averageVelocity(currentFingering, nseq);
                if (v < minvel) {
                    out = { fingering: [...currentFingering], velocity: v };
                    minvel = v;
                }
                return;
            }

            for (const f of fingers) {
                if (level > 0) {
                    const prevFing = currentFingering[level - 1];
                    const na = nseq[level - 1];
                    const nb = nseq[level];
                    if (!na || !nb) continue; // Prevent accessing undefined
                    if (this.skip(prevFing, f, na, nb, level)) continue;
                }
                currentFingering[level] = f;
                generateFingerings(level + 1, currentFingering);
            }
        };

        for (const f1 of u_start) {
            generateFingerings(1, [f1, ...Array(depth - 1).fill(0)]);
        }

        return out;
    }

    generate() {
        const N = this.noteseq.length;
        if (this.depth < 3) this.depth = 3;
        if (this.depth > 9) this.depth = 9;
        let start_finger = 0;
        let out = { fingering: [], velocity: 0 };

        for (let i = 0; i < N; i++) {
            const an = this.noteseq[i];
            let remainingNotes = N - i;
            let currentDepth = Math.min(this.depth, remainingNotes);
            if (currentDepth < 2) continue; // Not enough notes to process

            // Adjust depth for the last notes
            this.depth = currentDepth;

            let best_finger = 0;
            const notesSlice = this.noteseq.slice(i, i + currentDepth);
            out = this.optimizeSeq(notesSlice, start_finger);
            best_finger = out.fingering[0];
            start_finger = out.fingering[1] || 0;

            an.fingering = best_finger;
            this.setFingerPositions(out.fingering, notesSlice, 0);
            this.fingerseq.push([...this.cfps]);
            an.cost = out.velocity;
        }
    }
}

// Utility functions
function isBlackKey(midiNote) {
    const pc = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(pc);
}

function keyPosition(midiNote) {
    // Simplified key position based on midi note number
    return midiNote;
}

// File processing and UI logic

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const downloadLink = document.getElementById('download-link');
const outputDiv = document.getElementById('output'); // 可能为 null
const handSizeSelect = document.getElementById('hand-size-select');

// 保存原始数据和文件名
let originalData = null;
let originalFileName = null;

// Handle drag over
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('hover');
});

// Handle drag leave
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('hover');
});

// Handle drop
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
        processFile(file);
    } else {
        alert('Please drop a valid JSON file.');
    }
});

// Handle click to open file dialog
dropZone.addEventListener('click', (e) => {
    // 如果点击的是 fileInput 本身，不需要再次触发
    if (e.target !== fileInput) {
        fileInput.click();
    }
});

// 阻止 fileInput 的点击事件冒泡到 dropZone
fileInput.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Handle file selection
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && file.type === 'application/json') {
        processFile(file);
    } else {
        alert('Please select a valid JSON file.');
    }
});

// Handle process button click (分配指法)
const processBtn = document.getElementById('process-btn');
if (processBtn) {
    processBtn.addEventListener('click', assignFingering);
}

// Handle load sample data button
const loadSampleBtn = document.getElementById('load-sample-btn');
if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', loadSampleData);
}

/**
 * 加载示例数据（Piano Vision 格式，不带指法）
 */
function loadSampleData() {
    // 生成示例数据（Piano Vision 格式）
    const sampleData = {
        tracksV2: {
            right: [{
                notes: [
                    { note: 60, start: 0, duration: 0.5, noteName: 'C4' },
                    { note: 62, start: 0.5, duration: 0.5, noteName: 'D4' },
                    { note: 64, start: 1.0, duration: 0.5, noteName: 'E4' },
                    { note: 65, start: 1.5, duration: 0.5, noteName: 'F4' },
                    { note: 67, start: 2.0, duration: 0.5, noteName: 'G4' },
                    { note: 66, start: 2.5, duration: 0.5, noteName: 'F#4' },
                    { note: 65, start: 3.0, duration: 0.5, noteName: 'F4' },
                    { note: 64, start: 3.5, duration: 0.5, noteName: 'E4' },
                    { note: 62, start: 4.0, duration: 0.5, noteName: 'D4' },
                    { note: 61, start: 4.5, duration: 0.5, noteName: 'C#4' },
                    { note: 60, start: 5.0, duration: 0.5, noteName: 'C4' },
                    { note: 62, start: 5.5, duration: 0.5, noteName: 'D4' },
                    { note: 64, start: 6.0, duration: 0.5, noteName: 'E4' },
                    { note: 66, start: 6.5, duration: 0.5, noteName: 'F#4' },
                    { note: 68, start: 7.0, duration: 0.5, noteName: 'G#4' },
                    { note: 69, start: 7.5, duration: 0.5, noteName: 'A4' },
                    { note: 71, start: 8.0, duration: 0.0, noteName: 'B4' },
                    { note: 72, start: 8.0, duration: 1.0, noteName: 'C5' }
                ]
            }],
            left: [{
                notes: [
                    { note: 48, start: 0, duration: 1.0, noteName: 'C3' },
                    { note: 50, start: 1.0, duration: 1.0, noteName: 'D3' },
                    { note: 52, start: 2.0, duration: 1.0, noteName: 'E3' },
                    { note: 53, start: 3.0, duration: 1.0, noteName: 'F3' },
                    { note: 55, start: 4.0, duration: 1.0, noteName: 'G3' },
                    { note: 54, start: 5.0, duration: 1.0, noteName: 'F#3' },
                    { note: 53, start: 6.0, duration: 1.0, noteName: 'F3' },
                    { note: 52, start: 7.0, duration: 1.0, noteName: 'E3' },
                    { note: 50, start: 8.0, duration: 1.0, noteName: 'D3' },
                    { note: 49, start: 9.0, duration: 1.0, noteName: 'C#3' },
                    { note: 48, start: 10.0, duration: 2.0, noteName: 'C3' }
                ]
            }]
        }
    };

    // 保存原始数据和文件名
    originalData = JSON.parse(JSON.stringify(sampleData)); // 深拷贝
    originalFileName = 'sample_data.json';

    // 验证数据格式
    if (!sampleData.tracksV2 || typeof sampleData.tracksV2 !== 'object') {
        alert('示例数据格式错误。');
        return;
    }

    // 只加载原始数据到可视化器，不分配指法
    loadDataToVisualizer(sampleData);

    // 启用分配指法按钮
    if (processBtn) {
        processBtn.disabled = false;
    }

    // 隐藏下载区域（直到分配指法后才显示）
    const downloadSection = document.getElementById('download-section');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }

    console.log('Sample data loaded successfully. Ready for fingering assignment.');
}

function processFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // 保存原始数据和文件名
            originalData = JSON.parse(JSON.stringify(data)); // 深拷贝
            originalFileName = file.name;

            // 验证数据格式
            if (!data.tracksV2 || typeof data.tracksV2 !== 'object') {
                alert('JSON 文件中未找到有效的 tracksV2 数据。');
                return;
            }

            // 只加载原始数据到可视化器，不分配指法
            loadDataToVisualizer(data);

            // 启用分配指法按钮
            const processBtn = document.getElementById('process-btn');
            if (processBtn) {
                processBtn.disabled = false;
            }

            // 隐藏下载区域（直到分配指法后才显示）
            const downloadSection = document.getElementById('download-section');
            if (downloadSection) {
                downloadSection.style.display = 'none';
            }

            console.log('File loaded successfully. Ready for fingering assignment.');
        } catch (error) {
            alert('读取 JSON 文件时出错: ' + error.message);
        }
    };

    reader.readAsText(file);
}

/**
 * 加载数据到可视化器
 */
function loadDataToVisualizer(data) {
    // 检查可视化器是否存在
    if (typeof visualizer !== 'undefined' && visualizer) {
        try {
            visualizer.loadData(data);
            console.log('Data loaded into visualizer successfully');

            // 启用播放按钮
            const playBtn = document.getElementById('play-btn');
            const pauseBtn = document.getElementById('pause-btn');
            const stopBtn = document.getElementById('stop-btn');

            if (playBtn) playBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = false;
        } catch (error) {
            console.error('Error loading data into visualizer:', error);
            alert('加载数据到可视化器时出错: ' + error.message);
        }
    } else {
        console.warn('Visualizer not initialized. Data saved to sessionStorage.');
        // 将数据保存到 sessionStorage 以备后用
        sessionStorage.setItem('pianoVisionData', JSON.stringify(data));
    }
}

/**
 * 分配指法并更新可视化
 */
function assignFingering() {
    if (!originalData) {
        alert('请先上传 JSON 文件。');
        return;
    }

    try {
        // 深拷贝原始数据
        const data = JSON.parse(JSON.stringify(originalData));
        const handSize = handSizeSelect.value;
        
        // 分配指法
        const updatedData = processJSON(data, handSize);

        // 更新可视化器
        loadDataToVisualizer(updatedData);

        // 创建下载链接
        const blob = new Blob([JSON.stringify(updatedData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = originalFileName.replace('.json', '_updated.json');
        downloadLink.style.display = 'inline';

        // 显示下载区域
        const downloadSection = document.getElementById('download-section');
        if (downloadSection) {
            downloadSection.style.display = 'block';
        }

        // Display updated JSON in output div (optional) - 如果元素存在
        if (outputDiv) {
            outputDiv.textContent = JSON.stringify(updatedData, null, 2);
        }

        console.log('Fingering assigned successfully.');
    } catch (error) {
        alert('分配指法时出错: ' + error.message);
        console.error('Error assigning fingering:', error);
    }
}

function processJSON(data, handSize) {
    // Validate that tracksV2 exists and is an object
    if (!data.tracksV2 || typeof data.tracksV2 !== 'object') {
        alert('No valid tracksV2 data found in JSON.');
        return data;
    }

    // Process right and left hands
    for (const hand of ['right', 'left']) {
        if (Array.isArray(data.tracksV2[hand])) {
            // Flatten all notes from blocks
            let allNotes = [];
            data.tracksV2[hand].forEach((block) => {
                if (Array.isArray(block.notes)) {
                    block.notes.forEach((noteData) => {
                        allNotes.push(new Note(noteData));
                    });
                }
            });

            if (allNotes.length === 0) continue;

            // Create Hand instance and generate fingerings
            const handObj = new Hand(allNotes, hand, handSize);
            handObj.generate();

            // Update the original data with the assigned fingers
            let noteIndex = 0;
            data.tracksV2[hand].forEach((block) => {
                if (Array.isArray(block.notes)) {
                    block.notes.forEach((noteData) => {
                        if (allNotes[noteIndex]) {
                            let finger = allNotes[noteIndex].fingering;

                            // 左手镜像转换指法：1↔5, 2↔4, 3保持不变
                            if (hand === 'left') {
                                finger = mirrorLeftHandFinger(finger);
                            }

                            noteData.finger = finger;
                        }
                        noteIndex++;
                    });
                }
            });
        }
    }

    return data;
}