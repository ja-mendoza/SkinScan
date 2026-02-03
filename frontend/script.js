// SkinScan AI frontend logic
// Requires these IDs in index.html:
// file-upload, upload-btn, upload-btn-text, example-section, loading-spinner, results-section
// Tabs: .tab-button (data-tab="scan"/"info"), #scan-tab, #info-tab
// Accordion: .accordion-button, next sibling is .accordion-content

const API_URL = "http://127.0.0.1:8000/predict"

const fileInput = document.getElementById("file-upload")
const uploadBtn = document.getElementById("upload-btn")
const uploadBtnText = document.getElementById("upload-btn-text")

const exampleSection = document.getElementById("example-section")
const loadingSpinner = document.getElementById("loading-spinner")
const resultsSection = document.getElementById("results-section")

init()

function init() {
    wireTabs()
    wireAccordion()
    wireUpload()
}

function wireUpload() {
    if (!fileInput || !uploadBtn) return

    uploadBtn.addEventListener("click", (e) => {
        e.preventDefault()
        if (!uploadBtn.disabled) fileInput.click()
    })

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0]
        if (!file) return

        const ok = validateFile(file)
        if (!ok) return

        analyzeFile(file)
    })
}

function validateFile(file) {
    const maxBytes = 10 * 1024 * 1024
    const isImage = file.type && file.type.startsWith("image/")

    if (!isImage) {
        alert("Please upload an image file.")
        fileInput.value = ""
        return false
    }

    if (file.size > maxBytes) {
        alert("File too large. Max size is 10MB.")
        fileInput.value = ""
        return false
    }

    return true
}

async function analyzeFile(file) {
    showLoading()

    try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(API_URL, {
            method: "POST",
            body: formData
        })

        const data = await res.json()

        if (!res.ok) {
            hideLoading()
            renderError("Server error", data)
            return
        }

        if (data && data.error) {
            hideLoading()
            renderError("Prediction failed", data)
            return
        }

        hideLoading()
        renderResults(file, data)

    } catch (e) {
        hideLoading()
        renderError("Request failed", { error: String(e) })
    }
}

function showLoading() {
    if (exampleSection) exampleSection.classList.add("hidden")
    if (resultsSection) resultsSection.classList.add("hidden")
    if (loadingSpinner) loadingSpinner.classList.remove("hidden")

    if (uploadBtn) uploadBtn.disabled = true
    if (uploadBtnText) uploadBtnText.textContent = "Analyzing..."
}

function hideLoading() {
    if (loadingSpinner) loadingSpinner.classList.add("hidden")

    if (uploadBtn) uploadBtn.disabled = false
    if (uploadBtnText) uploadBtnText.textContent = "Choose File"
}

function renderResults(file, data) {
    if (!resultsSection) return

    const score = clamp01(Number(data.probability_malignant))
    const conf = clamp01(Number(data.confidence))
    const isMal = String(data.label).toLowerCase() === "malignant"

    const labelText = isMal ? "Malignant" : "Benign"
    const badgeClass = isMal ? "high" : "low"
    const imgUrl = URL.createObjectURL(file)

    const probPct = (score * 100).toFixed(2)
    const confPct = (conf * 100).toFixed(2)

    resultsSection.innerHTML = `
        <div class="card">
            <h3>Analysis Results</h3>

            <div class="results-grid">
                <div>
                    <img src="${imgUrl}" alt="Uploaded skin" class="results-image">
                </div>

                <div class="results-details">
                    <div>
                        <div class="risk-header">
                            <span>Prediction</span>
                            <span class="badge ${badgeClass}">${labelText}</span>
                        </div>

                        <div class="risk-box ${badgeClass}">
                            <span>Model output based on the uploaded image</span>
                        </div>
                    </div>

                    <div class="confidence-bar">
                        <div class="confidence-header">
                            <span>Malignant probability</span>
                            <span>${probPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${probPct}%;"></div>
                        </div>
                    </div>

                    <div class="confidence-bar">
                        <div class="confidence-header">
                            <span>Confidence</span>
                            <span>${confPct}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${confPct}%;"></div>
                        </div>
                    </div>

                    <div class="alert warning" style="margin-top:16px;">
                        <div class="alert-content">
                            <h4>Reminder</h4>
                            <p>This is a screening tool. For diagnosis and treatment, consult a dermatologist.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `

    resultsSection.classList.remove("hidden")
}

function renderError(title, data) {
    if (!resultsSection) return

    const msg = data && data.error ? escapeHtml(String(data.error)) : "Unknown error"
    const trace = data && data.trace ? escapeHtml(String(data.trace)) : ""

    resultsSection.innerHTML = `
        <div class="card">
            <h3>${escapeHtml(title)}</h3>
            <p style="color:#b91c1c; margin-top:8px;">${msg}</p>
            ${trace ? `<details style="margin-top:12px;"><summary>Details</summary><pre style="white-space:pre-wrap;">${trace}</pre></details>` : ""}
        </div>
    `
    resultsSection.classList.remove("hidden")
}

function wireTabs() {
    const buttons = document.querySelectorAll(".tab-button")
    if (!buttons.length) return

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const tabName = button.getAttribute("data-tab")
            if (!tabName) return

            document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"))
            button.classList.add("active")

            document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"))
            const tabEl = document.getElementById(tabName + "-tab")
            if (tabEl) tabEl.classList.add("active")
        })
    })
}

function wireAccordion() {
    const buttons = document.querySelectorAll(".accordion-button")
    if (!buttons.length) return

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const content = button.nextElementSibling
            const isActive = button.classList.contains("active")

            buttons.forEach((btn) => {
                btn.classList.remove("active")
                const c = btn.nextElementSibling
                if (c) c.style.maxHeight = null
            })

            if (!isActive && content) {
                button.classList.add("active")
                content.style.maxHeight = content.scrollHeight + "px"
            }
        })
    })
}

function clamp01(x) {
    if (Number.isNaN(x)) return 0
    if (x < 0) return 0
    if (x > 1) return 1
    return x
}

function escapeHtml(str) {
    return str
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}
