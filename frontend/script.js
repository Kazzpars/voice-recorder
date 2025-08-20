// === DOM ELEMENTS ===
const recordBtn = document.getElementById("recordBtn");
const uploadBtn = document.getElementById("uploadBtn");
const recordingsList = document.getElementById("recordingsList");

// === GLOBAL VARS ===
let mediaRecorder, audioChunks = [], audioBlob;
let audioContext, analyser, dataArrayTime, dataArrayFreq, bufferLength;
let canvasWave = document.getElementById("canvasWave");
let ctxWave = canvasWave.getContext("2d");
let canvasWaterfall = document.getElementById("canvasWaterfall");
let ctxWaterfall = canvasWaterfall.getContext("2d");
let token = null;

document.getElementById("loginBtn").onClick = async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
        const res = await fetch("http://127.0.0.1:5000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            token = data.token;
            alert("Login successful!");

            document.getElementById("loginForm").style.display = "none";
            await loadRecordings();
        } else {
            alert("Login failed: " + data.message);
        }
    } catch (error) {
        console.error("Error during login:", error);
        alert("Login failed");
    }
}

// === LOAD RECORDINGS ===
async function loadRecordings() {
    if (!token) {
        alert("You must be logged in to view recordings.");
        return;
    }
    const res = await fetch("http://127.0.0.1:5000/recordings", {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    const files = await res.json();

    recordingsList.innerHTML = "";
    files.forEach(file => {
        const li = document.createElement("li");

        const filename = file;
        const match = file.match(/recording_(\d{8})_(\d{6})\.webm/);
        let displayName = file;
        if (match) {
            const dateStr = match[1];
            const timeStr = match[2];
            displayName = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6,8)} ${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4,6)}`;
        }
        li.innerHTML = `
        <strong>${displayName}</strong>
        <audio controls src="http://127.0.0.1:5000/stream/${file}"></audio>
        <a class="download" href="http://127.0.0.1:5000/download/${file}" download>Download</a>
        <button class="delete" data-file="${file}">Delete</button>
        `;
        recordingsList.appendChild(li);
    });
}

// === EVENT LISTENER BUAT TOMBOL HAPUS ===
recordingsList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete")) {
        const file = e.target.dataset.file;
        console.log("Klik tombol delete:", file);

        if (confirm(`Are you sure you want to delete ${file}?`)) {
            try {
                const res = await fetch(`http://127.0.0.1:5000/delete/${file}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Failed to delete");
                await loadRecordings(); // refresh list
            } catch (err) {
                console.error("Error deleting recording:", err);
                alert("Failed to delete recording");
            }
        }
    }
});


// === START RECORDING ===
async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        uploadBtn.disabled = false;
    };

    mediaRecorder.start();

    // Init audio context + analyser
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArrayTime = new Uint8Array(bufferLength);
    dataArrayFreq = new Uint8Array(bufferLength);

    animateWave();

    recordBtn.textContent = "Stop Recording";
    recordBtn.style.backgroundColor = "#7f8c8d";
}

// === STOP RECORDING ===
function stopRecording() {
    mediaRecorder.stop();
    recordBtn.textContent = "Start Recording";
    recordBtn.style.backgroundColor = "#e74c3c";
}

// === BUTTON HANDLER ===
recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        await startRecording();
    } else {
        stopRecording();
    }
};

// === UPLOAD RECORDING ===
uploadBtn.onclick = async () => {
    if (!audioBlob || !token) return;

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
        const res = await fetch("http://127.0.0.1:5000/upload", {
            method: "POST",
            body: formData,
            headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("Upload failed");

        audioBlob = null;
        uploadBtn.disabled = true;
        await loadRecordings();
    } catch (err) {
        console.error("Error uploading audio:", err);
        alert("Upload gagal, check backend!");
        uploadBtn.disabled = false;
    }
};

// === VISUALIZER ===
function animateWave() {
    requestAnimationFrame(animateWave);
    drawWaveform();
    drawWaterfall();
}

function drawWaveform() {
    analyser.getByteTimeDomainData(dataArrayTime);

    ctxWave.fillStyle = "#111";
    ctxWave.fillRect(0, 0, canvasWave.width, canvasWave.height);

    ctxWave.lineWidth = 2;
    ctxWave.strokeStyle = "#4CAF50";
    ctxWave.beginPath();

    const sliceWidth = canvasWave.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArrayTime[i] / 128.0;
        const y = v * canvasWave.height / 2;

        if (i === 0) ctxWave.moveTo(x, y);
        else ctxWave.lineTo(x, y);

        x += sliceWidth;
    }

    ctxWave.lineTo(canvasWave.width, canvasWave.height / 2);
    ctxWave.stroke();
}

function drawWaterfall() {
    const existingImageData = ctxWaterfall.getImageData(0, 0, canvasWaterfall.width, canvasWaterfall.height - 1);
    ctxWaterfall.putImageData(existingImageData, 0, 1);

    analyser.getByteFrequencyData(dataArrayFreq);

    for (let i = 0; i < canvasWaterfall.width; i++) {
        const freqIndex = Math.floor(i * bufferLength / canvasWaterfall.width);
        const intensity = dataArrayFreq[freqIndex];

        const blue = Math.max(0, 255 - intensity * 2);
        const green = Math.max(0, intensity > 128 ? 255 - (intensity - 128) * 2 : intensity * 2);
        const red = Math.max(0, (intensity - 128) * 2);

        ctxWaterfall.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctxWaterfall.fillRect(i, 0, 1, 1);
    }
}

loadRecordings();
