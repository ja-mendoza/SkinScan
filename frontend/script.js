const API_URL = "https://skinscan-2ate.onrender.com/predict";
const HISTORY_URL = "https://skinscan-2ate.onrender.com/history";

const fileInput = document.getElementById("file-upload");
const uploadBtn = document.getElementById("upload-btn");
const uploadBtnText = document.getElementById("upload-btn-text");

const exampleSection = document.getElementById("example-section");
const loadingSpinner = document.getElementById("loading-spinner");
const resultsSection = document.getElementById("results-section");

init();

function init() {
    wireTabs();
    wireAccordion();
    wireUpload();
    loadHistory(); // ADD THIS
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
        alert("Please upload an image.");
        return false;
    }

    if (file.size > maxBytes) {
        alert("File too large. Max 10MB.");
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
            renderError(data.detail || "Server Error");
            return;
        }

        hideLoading();
        renderResults(file, data);

        // ✅ move here
        loadHistory();

    } catch (err) {
        hideLoading();
        renderError(String(err));
    }
}

function showLoading() {
    exampleSection.classList.add("hidden");
    resultsSection.classList.add("hidden");
    loadingSpinner.classList.remove("hidden");

    uploadBtn.disabled = true;
    uploadBtnText.textContent = "Analyzing...";
}

function hideLoading() {
    loadingSpinner.classList.add("hidden");

    uploadBtn.disabled = false;
    uploadBtnText.textContent = "Choose File";
}

function renderResults(file, data) {
    const imgUrl = URL.createObjectURL(file);

    const isMalignant = data.prediction === "malignant";
    const badgeClass = isMalignant ? "high" : "low";
    const binaryText = isMalignant ? "Malignant" : "Benign";

    const probPct = (Number(data.probability_malignant) * 100).toFixed(2);
    const confPct = (Number(data.confidence) * 100).toFixed(2);
    const lesionPct = (Number(data.lesion_confidence) * 100).toFixed(2);

    const topPredictionsHTML = data.top_predictions.map(item => {
        const pct = (Number(item.confidence) * 100).toFixed(2);

        return `
            <div class="confidence-bar" style="margin-top:12px;">
                <div class="confidence-header">
                    <span>${escapeHtml(item.label)}</span>
                    <span>${pct}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
        `;
    }).join("");

    resultsSection.innerHTML = `
        <div class="card">
            <h3>Analysis Results</h3>

            <div class="results-grid">

                <div>
                    <img src="${imgUrl}" class="results-image" alt="Uploaded Image">
                    <p style="margin-top:10px;font-weight:600;">Original Image</p>
                </div>

                <div class="results-details">

                    <div class="risk-header">
                        <span class="badge ${badgeClass}">
                            ${binaryText}
                        </span>
                    </div>

                    <div style="margin-top:10px;color:#444;font-size:14px;">
                        Risk Level: <strong>${escapeHtml(data.risk_level)}</strong>
                    </div>

                    <div style="margin-top:12px;font-size:15px;">
                        <strong>Detected Lesion Type:</strong><br>
                        ${escapeHtml(data.lesion_type)}
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
                            <span>Binary Confidence</span>
                            <span>${confPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${confPct}%"></div>
                        </div>
                    </div>

                    <div class="confidence-bar">
                        <div class="confidence-header">
                            <span>Lesion Confidence</span>
                            <span>${lesionPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${lesionPct}%"></div>
                        </div>
                    </div>

                </div>
            </div>

            <hr style="margin:25px 0;opacity:.15;">

            <h3>Top Predictions</h3>
            ${topPredictionsHTML}

            <hr style="margin:25px 0;opacity:.15;">

            <h3>Grad-CAM Explanation</h3>

            <div style="margin-top:15px;">
                <img 
                    src="data:image/jpeg;base64,${data.gradcam}" 
                    class="results-image"
                    alt="GradCAM"
                >
                <p style="margin-top:10px;font-size:14px;color:#555;">
                    Red/yellow areas indicate image regions that influenced the model most.
                </p>
            </div>

            <hr style="margin:25px 0;opacity:.15;">

            <p style="font-size:13px;color:#666;">
                ${escapeHtml(data.disclaimer)}
            </p>
        </div>
    `;

    resultsSection.classList.remove("hidden");
    // ADD THIS (force visibility)
    resultsSection.style.display = "block";
}

function renderError(msg) {
    resultsSection.innerHTML = `
        <div class="card">
            <h3>Error</h3>
            <p style="color:#b91c1c;">${escapeHtml(msg)}</p>
        </div>
    `;
    resultsSection.classList.remove("hidden");
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
    const container = document.getElementById("history-list");

    if (!items.length) {
        container.innerHTML = "<p>No history yet.</p>";
        return;
    }

    container.innerHTML = items.map(item => {
        const conf = (item.confidence * 100).toFixed(2);

        return `
            <div class="card" style="margin-bottom:10px;">
                <strong>${escapeHtml(item.image_name)}</strong><br>
                Result: <b>${escapeHtml(item.prediction)}</b><br>
                Lesion: ${escapeHtml(item.lesion_type)}<br>
                Confidence: ${conf}%<br>
                <small>${item.created_at}</small>
            </div>
        `;
    }).join("");
}