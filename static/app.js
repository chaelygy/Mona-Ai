/**
 * =====================================================================
 *  MONA AI &bull; ATELIER BIOMÉTRIQUE - Logic Engine
 *  Haute Couture Face Recognition with Crimson & Imperial Gold
 * =====================================================================
 */

const CLOUD_BACKEND_URL = 'https://features-architectural-anthony-posted.trycloudflare.com';

const isFileProtocol = window.location.protocol === 'file:';
const isLocal = Boolean(
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    isFileProtocol
);

let defaultApi = 'http://localhost:5000';
if (!isLocal) {
    defaultApi = CLOUD_BACKEND_URL;
} else if (!isFileProtocol && window.location.origin && window.location.origin !== 'null') {
    defaultApi = window.location.origin;
} else {
    defaultApi = 'http://localhost:5000';
}

const customApi = localStorage.getItem('faceid_backend_url');
let API_BASE = (customApi ? customApi.replace(/\/$/, '') : defaultApi);
const WEBCAM_INTERVAL_MS = 1400;
const JPEG_QUALITY = 0.86;

function configureServerUrl() {
    const current = localStorage.getItem('faceid_backend_url') || API_BASE;
    const input = prompt(
        "MONA AI • Konfigurasi Server Backend:\n" +
        "• Server Lokal: http://localhost:5000\n" +
        "• URL Cloudflare Tunnel: https://xxxx.trycloudflare.com\n\n" +
        "URL Saat Ini:",
        current
    );
    if (input !== null) {
        const clean = input.trim().replace(/\/$/, '');
        if (clean) {
            localStorage.setItem('faceid_backend_url', clean);
        } else {
            localStorage.removeItem('faceid_backend_url');
        }
        window.location.reload();
    }
}

// System State
let currentMode = 'webcam';
let webcamStream = null;
let webcamActive = false;
let captureInterval = null;
let isProcessing = false;
let registeredPersons = [];

const elements = {
    navStatus: document.getElementById('navStatus'),
    statPersons: document.getElementById('statPersons'),
    btnWebcam: document.getElementById('btnWebcam'),
    btnUpload: document.getElementById('btnUpload'),
    panelTitle: document.getElementById('panelTitle'),
    webcamControls: document.getElementById('webcamControls'),
    webcamWrapper: document.getElementById('webcamWrapper'),
    uploadWrapper: document.getElementById('uploadWrapper'),
    webcamVideo: document.getElementById('webcamVideo'),
    overlayCanvas: document.getElementById('overlayCanvas'),
    scanLine: document.getElementById('scanLine'),
    videoPlaceholder: document.getElementById('videoPlaceholder'),
    btnStartCam: document.getElementById('btnStartCam'),
    btnStopCam: document.getElementById('btnStopCam'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadedPreview: document.getElementById('uploadedPreview'),
    uploadedImage: document.getElementById('uploadedImage'),
    uploadOverlayCanvas: document.getElementById('uploadOverlayCanvas'),
    faceCount: document.getElementById('faceCount'),
    perfTime: document.getElementById('perfTime'),
    processingIndicator: document.getElementById('processingIndicator'),
    resultsList: document.getElementById('resultsList'),
    btnRefreshDb: document.getElementById('btnRefreshDb'),
    personsList: document.getElementById('personsList'),
    searchPersons: document.getElementById('searchPersons')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkServerHealth();
    loadPersons();
    setupEventListeners();
    setInterval(checkServerHealth, 10000);
});

function setupEventListeners() {
    if (elements.searchPersons) {
        elements.searchPersons.addEventListener('input', (e) => filterPersons(e.target.value));
    }

    if (elements.uploadZone) {
        elements.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.add('drag-over');
        });
        elements.uploadZone.addEventListener('dragleave', () => {
            elements.uploadZone.classList.remove('drag-over');
        });
        elements.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                processUploadedFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (elements.navStatus) {
        elements.navStatus.style.cursor = 'pointer';
        elements.navStatus.title = 'Klik untuk konfigurasi URL Server Backend';
        elements.navStatus.addEventListener('click', configureServerUrl);
    }

    window.addEventListener('resize', () => {
        if (webcamActive) syncCanvasSize();
    });
}

async function tryPingServer(url) {
    if (!url) return null;
    const cleanUrl = url.replace(/\/$/, '');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return await res.json();
    } catch (e) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(`${cleanUrl}/api/status`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) return await res.json();
        } catch (_) {}
    }
    return null;
}

async function checkServerHealth() {
    // 1. Coba endpoint yang saat ini aktif
    let data = await tryPingServer(API_BASE);

    // 2. Jika gagal dan bukan localhost, coba cek server lokal http://localhost:5000
    if (!data && API_BASE !== 'http://localhost:5000') {
        data = await tryPingServer('http://localhost:5000');
        if (data) {
            console.log('[MONA AI] Otomatis terhubung ke server lokal http://localhost:5000');
            API_BASE = 'http://localhost:5000';
        }
    }

    // 3. Jika masih belum berhasil dan ada CLOUD_BACKEND_URL, coba cloud tunnel
    if (!data && typeof CLOUD_BACKEND_URL !== 'undefined' && CLOUD_BACKEND_URL && API_BASE !== CLOUD_BACKEND_URL) {
        data = await tryPingServer(CLOUD_BACKEND_URL);
        if (data) {
            console.log('[MONA AI] Otomatis terhubung ke Cloudflare Tunnel:', CLOUD_BACKEND_URL);
            API_BASE = CLOUD_BACKEND_URL;
        }
    }

    if (data) {
        const count = data.persons_count || data.registered_persons_count || '24';
        updateServerStatus(true, `Terhubung (${count} Orang)`);
        if (elements.statPersons) {
            elements.statPersons.textContent = count;
        }
        if (registeredPersons.length === 0) {
            loadPersons();
        }
    } else {
        updateServerStatus(false, 'Terputus (Klik untuk Atur URL)');
    }
}

function updateServerStatus(online, text) {
    if (!elements.navStatus) return;
    const dot = elements.navStatus.querySelector('.ruby-status-dot');
    const label = elements.navStatus.querySelector('.ruby-status-text');
    if (dot) {
        dot.className = `ruby-status-dot ${online ? 'online' : 'offline'}`;
    }
    if (label) label.textContent = text;
}

async function loadPersons() {
    try {
        const res = await fetch(`${API_BASE}/api/persons`);
        if (res.ok) {
            const data = await res.json();
            registeredPersons = data.persons || [];
            renderPersonsList(registeredPersons);
            if (elements.statPersons) elements.statPersons.textContent = registeredPersons.length;
        }
    } catch (err) {
        console.warn('Could not load persons archive:', err);
    }
}

function renderPersonsList(persons) {
    if (!elements.personsList) return;
    if (persons.length === 0) {
        elements.personsList.innerHTML = `<div class="loading-velvet">Belum ada identitas terdaftar</div>`;
        return;
    }
    elements.personsList.innerHTML = persons.map(p => `
        <div class="mona-archive-node" title="${escapeHtml(p.name)}">
            <span class="node-monogram">${getInitials(p.name)}</span>
            <span class="node-name">${escapeHtml(p.name)}</span>
        </div>
    `).join('');
}

function filterPersons(query) {
    const q = query.toLowerCase().trim();
    const filtered = registeredPersons.filter(p => p.name.toLowerCase().includes(q));
    renderPersonsList(filtered);
}

function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    if (mode === 'webcam') {
        elements.btnWebcam.classList.add('active');
        elements.btnUpload.classList.remove('active');
        elements.webcamWrapper.classList.remove('hidden');
        elements.uploadWrapper.classList.add('hidden');
        elements.webcamControls.classList.remove('hidden');
        elements.panelTitle.textContent = 'Tampilan Kamera Langsung';
    } else {
        elements.btnUpload.classList.add('active');
        elements.btnWebcam.classList.remove('active');
        elements.webcamWrapper.classList.add('hidden');
        elements.uploadWrapper.classList.remove('hidden');
        elements.webcamControls.classList.add('hidden');
        elements.panelTitle.textContent = 'Unggah Foto / Gambar';
        if (webcamActive) stopWebcam();
    }
    clearResults();
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });

        webcamStream = stream;
        elements.webcamVideo.srcObject = stream;
        elements.webcamVideo.onloadedmetadata = () => {
            elements.webcamVideo.play();
            webcamActive = true;
            syncCanvasSize();
            elements.videoPlaceholder.classList.add('hidden');
            elements.scanLine.classList.remove('hidden');
            elements.btnStartCam.classList.add('hidden');
            elements.btnStopCam.classList.remove('hidden');
            startCaptureLoop();
        };
    } catch (err) {
        alert('Gagal mengakses kamera: ' + err.message);
    }
}

function stopWebcam() {
    webcamActive = false;
    if (captureInterval) clearInterval(captureInterval);
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (elements.webcamVideo) elements.webcamVideo.srcObject = null;
    if (elements.videoPlaceholder) elements.videoPlaceholder.classList.remove('hidden');
    if (elements.scanLine) elements.scanLine.classList.add('hidden');
    if (elements.btnStartCam) elements.btnStartCam.classList.remove('hidden');
    if (elements.btnStopCam) elements.btnStopCam.classList.add('hidden');

    const ctx = elements.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
    clearResults();
}

function syncCanvasSize() {
    const video = elements.webcamVideo;
    if (video.videoWidth && video.videoHeight) {
        elements.overlayCanvas.width = video.videoWidth;
        elements.overlayCanvas.height = video.videoHeight;
    }
}

function startCaptureLoop() {
    if (captureInterval) clearInterval(captureInterval);
    captureInterval = setInterval(captureAndSendFrame, WEBCAM_INTERVAL_MS);
    captureAndSendFrame();
}

async function captureAndSendFrame() {
    if (!webcamActive || isProcessing) return;
    const video = elements.webcamVideo;
    if (video.readyState < 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const imageData = tempCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
    await sendForRecognition(imageData, 'webcam');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) processUploadedFile(file);
}

function processUploadedFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar (JPG, PNG, WEBP).');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        elements.uploadedImage.src = imageData;
        elements.uploadZone.classList.add('hidden');
        elements.uploadedPreview.classList.remove('hidden');

        elements.uploadedImage.onload = async () => {
            const img = elements.uploadedImage;
            elements.uploadOverlayCanvas.width = img.naturalWidth;
            elements.uploadOverlayCanvas.height = img.naturalHeight;
            await sendForRecognition(imageData, 'upload');
        };
    };
    reader.readAsDataURL(file);
}

function removeUpload() {
    elements.uploadedImage.src = '';
    elements.uploadedPreview.classList.add('hidden');
    elements.uploadZone.classList.remove('hidden');
    elements.fileInput.value = '';
    const ctx = elements.uploadOverlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.uploadOverlayCanvas.width, elements.uploadOverlayCanvas.height);
    clearResults();
}

async function sendForRecognition(imageData, source) {
    if (isProcessing) return;
    isProcessing = true;
    if (elements.processingIndicator) elements.processingIndicator.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/recognize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        const data = await res.json();
        if (data.error) {
            console.error('Recognition error:', data.error);
        } else {
            displayResults(data.faces, data.processing_time_ms);
            if (source === 'webcam') {
                drawBoundingBoxes(elements.overlayCanvas, data.faces, true);
            } else {
                drawBoundingBoxes(elements.uploadOverlayCanvas, data.faces, false);
            }
        }
    } catch (err) {
        console.error('Kendala koneksi server:', err);
    } finally {
        isProcessing = false;
        if (elements.processingIndicator) elements.processingIndicator.classList.add('hidden');
    }
}

// Bounding box: Crimson Velvet & Imperial Champagne Gold
function drawBoundingBoxes(canvas, faces, isMirrored) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    faces.forEach(face => {
        let { x, y, w: bw, h: bh } = face.bbox;
        if (isMirrored) {
            x = w - x - bw;
        }

        const isRecognized = face.name !== 'Unknown';
        const color = isRecognized ? '#fbbf24' : '#e11d48';
        const glowColor = isRecognized ? 'rgba(251, 191, 36, 0.5)' : 'rgba(225, 29, 72, 0.45)';

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;

        // Elegant ornate gilded corner brackets
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        const cornerLen = Math.min(bw, bh) * 0.22;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLen, y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + bw - cornerLen, y);
        ctx.lineTo(x + bw, y);
        ctx.lineTo(x + bw, y + cornerLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + bh - cornerLen);
        ctx.lineTo(x, y + bh);
        ctx.lineTo(x + cornerLen, y + bh);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + bw - cornerLen, y + bh);
        ctx.lineTo(x + bw, y + bh);
        ctx.lineTo(x + bw, y + bh - cornerLen);
        ctx.stroke();

        // Fine luxury inner frame
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isRecognized ? 'rgba(251, 191, 36, 0.25)' : 'rgba(225, 29, 72, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, bw, bh);

        // Ornate Label
        const label = isRecognized 
            ? `${face.name} &bull; ${face.confidence}%` 
            : 'TIDAK DIKENAL';
        
        ctx.font = `600 ${Math.max(13, bw * 0.058)}px "Plus Jakarta Sans", sans-serif`;
        const textMetrics = ctx.measureText(label.replace('&bull;', '•'));
        const textW = textMetrics.width + 20;
        const textH = Math.max(26, bw * 0.08);
        const labelY = y - textH - 8;

        // Velvet pill with gold border
        ctx.fillStyle = isRecognized ? 'rgba(136, 19, 55, 0.96)' : 'rgba(190, 18, 60, 0.96)';
        roundRect(ctx, x, labelY, textW, textH, 6);
        ctx.fill();
        ctx.strokeStyle = isRecognized ? '#fbbf24' : '#e11d48';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = isRecognized ? '#fbbf24' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.replace('&bull;', '•'), x + 10, labelY + textH / 2);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function displayResults(faces, processingTime) {
    if (elements.faceCount) elements.faceCount.textContent = `${faces.length} Wajah Terdeteksi`;
    if (elements.perfTime) elements.perfTime.textContent = `${Math.round(processingTime)} ms`;

    if (!elements.resultsList) return;
    if (faces.length === 0) {
        elements.resultsList.innerHTML = `
            <div class="mona-idle-box">
                <div class="idle-rose-icon">&#10022;</div>
                <h3>Tidak Ada Wajah Terdeteksi</h3>
                <p>Pastikan wajah terlihat jelas dan menghadap kamera dengan pencahayaan cukup.</p>
            </div>
        `;
        return;
    }

    const sorted = [...faces].sort((a, b) => {
        if (a.name === 'Unknown' && b.name !== 'Unknown') return 1;
        if (a.name !== 'Unknown' && b.name === 'Unknown') return -1;
        return b.confidence - a.confidence;
    });

    elements.resultsList.innerHTML = sorted.map(face => {
        const isRecognized = face.name !== 'Unknown';
        const cardClass = isRecognized ? 'recognized' : 'unknown';
        const initials = isRecognized ? getInitials(face.name) : '?';
        const statusBadge = isRecognized ? 'TERVERIFIKASI' : 'TIDAK DIKENAL';

        return `
            <div class="mona-result-card ${cardClass}">
                <div class="card-upper">
                    <div class="card-profile">
                        <div class="card-seal-avatar">${initials}</div>
                        <div>
                            <div class="card-subject-name">${escapeHtml(face.name)}</div>
                            <span style="font-size: 0.65rem; color: #9f1239;">Identitas Biometrik</span>
                        </div>
                    </div>
                    <span class="card-cert-badge">${statusBadge}</span>
                </div>
                <div class="card-metrics-row">
                    <span class="metric-accuracy">Akurasi: ${face.confidence}%</span>
                    <span class="metric-distance">Jarak Cosine: ${face.distance}</span>
                </div>
                ${isRecognized ? `
                    <div class="card-gold-bar-container">
                        <div class="card-gold-bar" style="width: ${face.confidence}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function clearResults() {
    if (elements.faceCount) elements.faceCount.textContent = '0 Wajah Terdeteksi';
    if (elements.perfTime) elements.perfTime.textContent = '0 ms';
    if (elements.resultsList) {
        elements.resultsList.innerHTML = `
            <div class="mona-idle-box" id="emptyState">
                <div class="idle-rose-icon">&#10022;</div>
                <h3>Menunggu Deteksi Wajah</h3>
                <p>Arahkan wajah Anda ke kamera atau unggah foto untuk mendeteksi identitas secara instan.</p>
            </div>
        `;
    }
}

function getInitials(name) {
    return name.split(' ')
        .filter(w => w.length > 0)
        .map(w => w[0].toUpperCase())
        .slice(0, 2)
        .join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
