const API_URL = "http://127.0.0.1:8000/predict";
const HISTORY_URL = "http://127.0.0.1:8000/history";


const fileInput = document.getElementById("file-upload");
const uploadBtn = document.getElementById("upload-btn");
const uploadBtnText = document.getElementById("upload-btn-text");

const loadingSpinner = document.getElementById("loading-spinner");
const resultsSection = document.getElementById("results-section");

const camera = document.getElementById("camera");

const canvas = document.getElementById("snapshotCanvas");

const captureBtn = document.getElementById("captureBtn");

const analyzeBtn = document.getElementById("analyzeBtn");

const errorTitle =
    document.querySelector(".error-popup h3");

const errorActionBtn =
    document.getElementById("errorActionBtn");

const errorModal =
    document.getElementById("errorModal");

const errorMessage =
    document.getElementById("errorMessage");

const closeErrorBtn =
    document.getElementById("closeErrorBtn");

function showError(

    message,

    title = "Scan Error",

    actionText = null,

    actionCallback = null

) {

    errorTitle.textContent = title;

    errorMessage.textContent = message;

    // reset button
    errorActionBtn.classList.add("hidden");

    errorActionBtn.onclick = null;

    // optional action
    if (actionText && actionCallback) {

        errorActionBtn.textContent =
            actionText;

        errorActionBtn.classList.remove("hidden");

        errorActionBtn.onclick = async () => {

            hideError();

            stopCamera();

            await actionCallback();
        };
    }

    errorModal.classList.remove("hidden");
}

function hideError() {

    errorModal.classList.add("hidden");
}

closeErrorBtn.addEventListener(
    "click",
    hideError
);

let historyData = [];

init();

function init() {
    wireTabs();
    wireAccordion();
    wireUpload();

    // fetch("https://skinscan-production.up.railway.app/health")
    //     .then(() => console.log("Backend warmed"))
    //     .catch(() => {});

    loadHistory();
    wireCamera();
}
wireModeSwitch();

function wireModeSwitch(){

    const uploadBtn =
        document.getElementById("uploadModeBtn");

    const cameraBtn =
        document.getElementById("cameraModeBtn");

    const uploadSection =
        document.getElementById("uploadSection");

    const cameraSection =
        document.getElementById("cameraSection");

    const modeTitle =
        document.getElementById("modeTitle");

    const modeDescription =
        document.getElementById("modeDescription");

    const modeInfo =
        document.getElementById("modeInfo");

    // ADD THESE
    const uploadIcon =
        document.querySelector(".upload-icon-wrapper");

    const uploadText =
        document.querySelector(".upload-text");

    uploadBtn.addEventListener("click", () => {

        uploadBtn.classList.add("active");
        cameraBtn.classList.remove("active");

        uploadSection.classList.remove("hidden");
        cameraSection.classList.add("hidden");
        

        // SHOW ICON/TEXT AGAIN
        uploadIcon.style.display = "block";
        uploadText.style.display = "block";

        modeTitle.textContent =
            "Upload Skin Image";

        modeDescription.textContent =
            "Upload a clear photo of the skin area you want to analyze";

        modeInfo.textContent =
            "Supported formats: JPG, PNG, HEIC • Max size: 10MB";

        stopCamera();

        camera.style.display = "none";

        canvas.style.display = "none";

        capturedFile = null;

        captureBtn.textContent = "Capture";

        analyzeBtn.disabled = true;

    });

    cameraBtn.addEventListener("click", () => {

        cameraBtn.classList.add("active");
        uploadBtn.classList.remove("active");

        uploadSection.classList.add("hidden");
        cameraSection.classList.remove("hidden");

        // HIDE ICON/TEXT
        uploadIcon.style.display = "none";
        uploadText.style.display = "none";

        modeTitle.textContent =
            "Live Camera Capture";

        modeDescription.textContent =
            "Capture a close-up skin image using your camera";

        modeInfo.textContent =
            "Camera capture only accepts skin or dermoscopic images";

        camera.style.display = "block";

        canvas.style.display = "none";

        captureBtn.textContent = "Capture";

        startCamera();
    });

}

function wireUpload() {
    uploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (uploadBtn.disabled) return;
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!validateFile(file)) {
            fileInput.value = "";
            return;
        }

        analyzeFile(file);
    });
}

function validateFile(file) {
    const maxBytes = 10 * 1024 * 1024;

    if (!file.type.startsWith("image/")) {
        showError("Please upload an image.");
        return false;
    }

    if (file.size > maxBytes) {
        showError("File too large. Maximum size is 10MB.");
        return false;
    }

    return true;
}

async function analyzeFile(file) {
    showLoading();

    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        console.log("API RESPONSE:", data);

        if (!res.ok) {
            hideLoading();
            showError(data.detail || "Server Error");
            return;
        }

        hideLoading();
        renderResults(file, data);

        // ✅ move here
        loadHistory();

    } catch (err) {
        hideLoading();
            showError(

            err.message || "Analysis failed.",

            "Scan Error"
        );
    }
}

function showLoading() {

    if (resultsSection) {
        resultsSection.classList.add("hidden");
    }

    if (loadingSpinner) {
        loadingSpinner.classList.remove("hidden");
    }

    uploadBtn.disabled = true;

    uploadBtnText.textContent =
        "Analyzing...";
}

function hideLoading() {
    loadingSpinner.classList.add("hidden");

    uploadBtn.disabled = false;
    uploadBtnText.textContent = "Choose File";
}

let currentStream = null;
let capturedFile = null;

function wireCamera() {

    captureBtn.addEventListener(
        "click",
        () => {

            // if already captured -> retake
            if (capturedFile) {
                retakeCapture();
            }

            // otherwise capture
            else {
                captureImage();
            }
        }
    );

    analyzeBtn.addEventListener(
        "click",
        analyzeCapturedImage
    );
}

async function startCamera() {

    try {

        if (currentStream) {
            return;
        }

        currentStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },

                audio: false
            });

        camera.style.display = "block";

        camera.srcObject = currentStream;

    } catch (err) {

    console.log(err);

    // permission denied
    if (err.name === "NotAllowedError") {

        showError(

            "Camera access was denied. Please enable camera permissions in your browser settings and try again.",

            "Camera Permission Error",

            "Retry Camera",

            async () => {

                stopCamera();

                await startCamera();
            }
        );
    }

    // no camera device
    else if (err.name === "NotFoundError") {

        showError(

            "No camera device was detected on this device.",

            "Camera Error"
        );
    }

    // camera already used elsewhere
    else if (err.name === "NotReadableError") {

        showError(

            "Camera is currently being used by another application.",

            "Camera Busy"
        );
    }

    // insecure context / browser issue
    else if (err.name === "SecurityError") {

        showError(

            "Camera access requires HTTPS or localhost.",

            "Security Error"
        );
    }

    // fallback
    else {

        showError(

            "Unable to access camera.",

            "Camera Error",

            "Retry Camera",

            async () => {

                stopCamera();

                await startCamera();
            }
        );
    }
}
}

function stopCamera() {

    if (!currentStream) return;

    currentStream.getTracks().forEach(track => {
        track.stop();
    });

    currentStream = null;
}

function captureImage() {

    const ctx = canvas.getContext("2d");

    // keep original camera aspect ratio
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    ctx.drawImage(
        camera,
        0,
        0,
        canvas.width,
        canvas.height
    );

    canvas.toBlob((blob) => {

        const now = new Date();

        const uniqueName =
            `capture_${now.getFullYear()}-${
                now.getMonth()+1
            }-${
                now.getDate()
            }_${
                now.getHours()
            }-${
                now.getMinutes()
            }-${
                now.getSeconds()
            }.jpg`;

        capturedFile = new File(
            [blob],
            uniqueName,
            {
                type: "image/jpeg"
            }
        );

        analyzeBtn.disabled = false;

    }, "image/jpeg", 0.95);

    // hide video
    camera.style.display = "none";

    // show captured image
    canvas.style.display = "block";

    captureBtn.textContent = "Retake";
}

async function retakeCapture() {

    capturedFile = null;

    analyzeBtn.disabled = true;

    canvas.style.display = "none";

    camera.style.display = "block";

    captureBtn.textContent = "Capture";

    // restart camera if needed
    if (!currentStream) {
        await startCamera();
    }
}

function analyzeCapturedImage() {

    if (!capturedFile) {
        showError("Capture an image first.");
        return;
    }

    analyzeFile(capturedFile);
}

const lesionInfo = {

    Melanoma: {

        description:
            "Melanoma is an aggressive form of skin cancer that develops from melanocytes. Early detection is critical because melanoma can spread rapidly to other organs.",

        signs: [
            "Asymmetrical shape",
            "Irregular borders",
            "Multiple colors",
            "Rapid growth or evolution",
            "Dark uneven pigmentation"
        ]
    },

    "Basal Cell Carcinoma": {

        description:
            "Basal Cell Carcinoma is the most common type of skin cancer. It grows slowly and rarely spreads but should still be treated promptly.",

        signs: [
            "Pearly or waxy bump",
            "Visible blood vessels",
            "Slow-growing lesion",
            "Sores that do not heal"
        ]
    },

    "Squamous Cell Carcinoma": {

        description:
            "Squamous Cell Carcinoma develops in the outer skin layers and may spread if untreated.",

        signs: [
            "Scaly red patches",
            "Open sores",
            "Raised growths",
            "Crusted surface"
        ]
    },

    "Actinic Keratosis": {

        description:
            "Actinic Keratosis is a rough or scaly patch caused by long-term sun exposure.",

        signs: [
            "Dry rough skin",
            "Scaly patches",
            "Pink or brown discoloration",
            "Sun-damaged appearance"
        ]
    },

    Nevus: {

        description:
            "A nevus, commonly called a mole, is usually benign and harmless.",

        signs: [
            "Uniform color",
            "Smooth border",
            "Stable appearance",
            "Small round lesion"
        ]
    },

    Dermatofibroma: {

        description:
            "Dermatofibroma is a benign skin growth commonly found on the arms or legs.",

        signs: [
            "Firm small bump",
            "Brownish coloration",
            "Dimple when pinched"
        ]
    },

    "Pigmented Benign Keratosis": {

        description:
            "Pigmented Benign Keratosis is a non-cancerous skin lesion.",

        signs: [
            "Waxy texture",
            "Dark pigmentation",
            "Raised appearance"
        ]
    }
};

function renderResults(file, data) {
    const imgUrl = URL.createObjectURL(file);

    const isMalignant = data.prediction === "malignant";
    const badgeClass = isMalignant ? "high" : "low";
    const binaryText = isMalignant ? "Malignant" : "Benign";

    const probPct = (Number(data.probability_malignant) * 100).toFixed(2);
    const confPct = (Number(data.confidence) * 100).toFixed(2);
    const lesionPct = (Number(data.lesion_confidence) * 100).toFixed(2);

    // const topPredictionsHTML = data.top_predictions.map(item => {
    //     const pct = (Number(item.confidence) * 100).toFixed(2);

    //     return `
    //         <div class="confidence-bar" style="margin-top:12px;">
    //             <div class="confidence-header">
    //                 <span>${escapeHtml(item.label)}</span>
    //                 <span>${pct}%</span>
    //             </div>
    //             <div class="progress-bar">
    //                 <div class="progress-fill" style="width:${pct}%"></div>
    //             </div>
    //         </div>
    //     `;
    // }).join("");

    resultsSection.innerHTML = `
        <div class="card">
            <h3>Analysis Results</h3>

            <div class="results-grid">

                <div >
                    <div class="image-container">
                        <img src="${imgUrl}" class="results-image" id="originalImage">

                        <img 
                            src="data:image/jpeg;base64,${data.gradcam}" 
                            class="gradcam-overlay"
                            id="gradcamOverlay"
                        >
                    </div>
                </div>

                <div class="results-details">

                    <div class="risk-header">

                        <span class="badge ${badgeClass}">
                            ${binaryText}
                        </span>

                    </div>
                    <div style="margin-top:12px;font-size:15px;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <strong>Detected Lesion Type:</strong>

                            <span>
                                ${escapeHtml(data.lesion_type)}
                            </span>

                        </div>
                    </div>

                    <div class="confidence-bar">
                        <div class="confidence-header">
                            <span>Malignant Probability</span>
                            <span>${probPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${probPct}%"></div>
                        </div>
                    </div>

                    <div class="confidence-bar">
                        <div class="confidence-header">
                            <span>Confidence</span>
                            <span>${confPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${confPct}%"></div>
                        </div>
                    </div>

                    <div class="lesion-info-card">

                        <div class="lesion-info-header">

                            <div class="lesion-info-icon">

                                <svg
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>

                            </div>

                            <h4>
                                About This Lesion
                            </h4>

                        </div>

                        <p>
                            ${
                                escapeHtml(
                                    lesionInfo[data.lesion_type]?.description
                                    || "No additional information available."
                                )
                            }
                        </p>

                        <div class="common-signs">

                            <h5>
                                Common Signs
                            </h5>

                            <ul class="signs-grid">

                                ${
                                    (
                                        lesionInfo[data.lesion_type]?.signs || []
                                    ).map(sign => `
                                        <li>${escapeHtml(sign)}</li>
                                    `).join("")
                                }

                            </ul>

                        </div>

                    </div>
                </div>
            </div>

            <hr style="margin:25px 0;opacity:.15;">
        </div>
    `;

    resultsSection.classList.remove("hidden");
    // ADD THIS (force visibility)
    resultsSection.style.display = "block";

    const orig = document.getElementById("originalImage");
    const cam  = document.getElementById("gradcamOverlay");

    if (orig && cam) {
        orig.onload = () => {
            console.log("ORIGINAL:", orig.naturalWidth, orig.naturalHeight);
        };

        cam.onload = () => {
            console.log("GRADCAM:", cam.naturalWidth, cam.naturalHeight);
        };
    }
}

function wireTabs() {
    const buttons = document.querySelectorAll(".tab-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const tab = button.dataset.tab;

            document.querySelectorAll(".tab-button")
                .forEach(btn => btn.classList.remove("active"));

            document.querySelectorAll(".tab-content")
                .forEach(content => content.classList.remove("active"));

            button.classList.add("active");
            document.getElementById(tab + "-tab").classList.add("active");
        });
    });
}

function wireAccordion() {
    const buttons = document.querySelectorAll(".accordion-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const content = button.nextElementSibling;
            const active = button.classList.contains("active");

            buttons.forEach(btn => {
                btn.classList.remove("active");
                btn.nextElementSibling.style.maxHeight = null;
            });

            if (!active) {
                button.classList.add("active");
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadHistory() {
    try {
        const res = await fetch(HISTORY_URL);
        const data = await res.json();

        renderHistory(data.history);
    } catch (err) {
        console.error("History error:", err);
    }
}

function renderHistory(items) {

    historyData = items;

    const container =
        document.getElementById("history-list");

    if (!items.length) {

        container.innerHTML =
            "<p>No history yet.</p>";

        return;
    }

    container.innerHTML = items.map((item, index) => {

        const conf =
            (item.confidence * 100).toFixed(2);

        return `

<div
    class="history-card"
    onclick="openHistoryResult(${index})"
>

    <div class="history-thumbnail">

        <img
            src="data:image/jpeg;base64,${item.image_base64}"
            alt="History Image"
        >

    </div>

    <div class="history-content">

        <div class="history-top-row">

            <h4>
                ${escapeHtml(item.lesion_type)}
            </h4>

            <span class="
                history-badge
                ${item.prediction === 'malignant'
                    ? 'high'
                    : 'low'}
            ">

                ${escapeHtml(item.prediction)}

            </span>

        </div>

        <div class="history-meta">

            <span>
                Confidence:
                ${(
                    Number(item.confidence) * 100
                ).toFixed(2)}%
            </span>

            <span>
                ${item.created_at}
            </span>

        </div>

        <div class="history-filename">

            ${escapeHtml(item.image_name)}

        </div>

    </div>

</div>
`;
    }).join("");
}

function openHistoryResult(index) {

    const item = historyData[index];

    if (!item) {
        return;
    }

    const probPct =
        (Number(item.probability_malignant) * 100)
        .toFixed(2);

    const confPct =
        (Number(item.confidence) * 100)
        .toFixed(2);

    const isMalignant =
        item.prediction === "malignant";

    const badgeClass =
        isMalignant ? "high" : "low";

    const binaryText =
        isMalignant ? "Malignant" : "Benign";

    resultsSection.innerHTML = `

        <div class="card">

            <h3>Previous Scan Result</h3>

            <div class="results-grid">

                <div>

                    <div class="image-container">

                        <img
                            src="data:image/jpeg;base64,${item.image_base64}"
                            class="results-image"
                        >

                    </div>

                </div>

                <div class="results-details">

                    <div class="risk-header">

                        <span class="badge ${badgeClass}">
                            ${binaryText}
                        </span>

                    </div>

                    <div style="
                        margin-top:10px;
                        color:#444;
                        font-size:14px;
                    ">

                    </div>

                    <div style="
                        margin-top:12px;
                        font-size:15px;
                    ">

                        <strong>
                            Detected Lesion Type:
                        </strong>

                        ${escapeHtml(item.lesion_type)}

                    </div>

                    <div class="confidence-bar">

                        <div class="confidence-header">

                            <span>
                                Malignant Probability
                            </span>

                            <span>
                                ${probPct}%
                            </span>

                        </div>

                        <div class="progress-bar">

                            <div
                                class="progress-fill"
                                style="width:${probPct}%"
                            ></div>

                        </div>

                    </div>

                    <div class="confidence-bar">

                        <div class="confidence-header">

                            <span>
                                Confidence
                            </span>

                            <span>
                                ${confPct}%
                            </span>

                        </div>

                        <div class="progress-bar">

                            <div
                                class="progress-fill"
                                style="width:${confPct}%"
                            ></div>

                        </div>

                    </div>

                    <div class="lesion-info-card">

                        <div class="lesion-info-header">

                            <div class="lesion-info-icon">

                                <svg
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>

                            </div>

                            <h4>
                                About This Lesion
                            </h4>

                        </div>

                        <p>

                            ${
                                escapeHtml(
                                    lesionInfo[item.lesion_type]?.description
                                    || "No additional information available."
                                )
                            }

                        </p>

                        <div class="common-signs">

                            <h5>
                                Common Signs
                            </h5>

                            <ul class="signs-grid">

                                ${
                                    (
                                        lesionInfo[item.lesion_type]?.signs || []
                                    ).map(sign => `
                                        <li>${escapeHtml(sign)}</li>
                                    `).join("")
                                }

                            </ul>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    `;

    resultsSection.classList.remove("hidden");

    resultsSection.scrollIntoView({
        behavior: "smooth"
    });
}

let gradcamVisible = false;

function toggleGradcam() {
    const overlay = document.getElementById("gradcamOverlay");

    gradcamVisible = !gradcamVisible;

    overlay.style.opacity = gradcamVisible ? 0.8 : 0;
}

