
        // Example data
        const exampleResults = [
            {
                riskLevel: "low",
                confidence: 92,
                detectedFeatures: ["Uniform color", "Symmetrical shape", "Regular border", "Small diameter"],
                recommendation: "The analyzed area shows low-risk characteristics. Continue regular self-examinations and maintain sun protection habits. Schedule annual dermatologist check-ups.",
                imageUrl: "https://images.unsplash.com/photo-1541752857837-f8a0154fd092?w=800"
            },
            {
                riskLevel: "medium",
                confidence: 78,
                detectedFeatures: ["Slight asymmetry", "Color variation", "Border irregularity"],
                recommendation: "The analyzed area shows some concerning features. We recommend scheduling a consultation with a dermatologist within the next 2-4 weeks for professional evaluation.",
                imageUrl: "https://images.unsplash.com/photo-1541752857837-f8a0154fd092?w=800"
            },
            {
                riskLevel: "high",
                confidence: 85,
                detectedFeatures: ["High asymmetry", "Multiple colors", "Irregular border", "Large diameter", "Recent changes"],
                recommendation: "The analyzed area exhibits multiple warning signs. Please consult a dermatologist as soon as possible, ideally within the next few days, for a thorough examination.",
                imageUrl: "https://images.unsplash.com/photo-1541752857837-f8a0154fd092?w=800"
            }
        ];

        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Update buttons
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update content
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(tabName + '-tab').classList.add('active');
            });
        });

        // Accordion functionality
        document.querySelectorAll('.accordion-button').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                const isActive = button.classList.contains('active');
                
                // Close all accordion items
                document.querySelectorAll('.accordion-button').forEach(btn => {
                    btn.classList.remove('active');
                    btn.nextElementSibling.style.maxHeight = null;
                });
                
                // Open clicked item if it was closed
                if (!isActive) {
                    button.classList.add('active');
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            });
        });

        // File upload
        const fileInput = document.getElementById('file-upload');
        const uploadBtn = document.getElementById('upload-btn');
        const uploadBtnText = document.getElementById('upload-btn-text');

        uploadBtn.addEventListener('click', () => {
            if (!uploadBtn.disabled) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                analyzeImage(URL.createObjectURL(file));
            }
        });

        // Toast notification
        function showToast(type, title, description) {
            const existingToast = document.querySelector('.toast');
            if (existingToast) {
                existingToast.remove();
            }

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icon = type === 'success' 
                ? '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
                : '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
            
            toast.innerHTML = `
                ${icon}
                <div class="toast-content">
                    <div class="toast-title">${title}</div>
                    <div class="toast-description">${description}</div>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        // Load example
        function loadExample(index) {
            const result = exampleResults[index];
            showLoading();
            showToast('info', 'Loading example analysis...', 'Demonstrating AI analysis results');
            
            setTimeout(() => {
                displayResults(result);
                hideLoading();
                showToast('success', 'Example loaded!', 'Review the analysis results below');
            }, 1500);
        }

        // Analyze image
        function analyzeImage(imageUrl) {
            showLoading();
            showToast('info', 'Analyzing image...', 'Our AI is examining the uploaded image');
            
            setTimeout(() => {
                // Random risk level for uploaded images
                const randomIndex = Math.floor(Math.random() * 3);
                const result = {
                    ...exampleResults[randomIndex],
                    imageUrl: imageUrl,
                    confidence: Math.floor(Math.random() * 20) + 75
                };
                displayResults(result);
                hideLoading();
                showToast('success', 'Analysis complete!', 'Scroll down to view your results');
            }, 2500);
        }

        // Show loading state
        function showLoading() {
            document.getElementById('example-section').classList.add('hidden');
            document.getElementById('results-section').classList.add('hidden');
            document.getElementById('loading-spinner').classList.remove('hidden');
            uploadBtn.disabled = true;
            uploadBtnText.textContent = 'Analyzing...';
        }

        // Hide loading state
        function hideLoading() {
            document.getElementById('loading-spinner').classList.add('hidden');
            uploadBtn.disabled = false;
            uploadBtnText.textContent = 'Choose File';
        }

        // Display results
        // function displayResults(result) {
        //     const resultsSection = document.getElementById('results-section');
        //     const riskIcon = result.riskLevel === 'low' 
        //         ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
        //         : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
            
        //     const featuresTags = result.detectedFeatures.map(feature => 
        //         `<span class="feature-tag">${feature}</span>`
        //     ).join('');

        //     resultsSection.innerHTML = `
        //         <!-- Results Card -->
        //         <div class="card">
        //             <h3>Analysis Results</h3>
        //             <div class="results-grid">
        //                 <!-- Image -->
        //                 <div>
        //                     <img src="${result.imageUrl}" alt="Analyzed skin lesion" class="results-image">
        //                 </div>
                        
        //                 <!-- Details -->
        //                 <div class="results-details">
        //                     <!-- Risk Assessment -->
        //                     <div>
        //                         <div class="risk-header">
        //                             <span>Risk Assessment</span>
        //                             <span class="badge ${result.riskLevel}">${result.riskLevel.toUpperCase()}</span>
        //                         </div>
        //                         <div class="risk-box ${result.riskLevel}">
        //                             <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        //                                 ${riskIcon}
        //                             </svg>
        //                             <span>Risk Level: ${result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)}</span>
        //                         </div>
        //                     </div>

        //                     <!-- Confidence Score -->
        //                     <div class="confidence-bar">
        //                         <div class="confidence-header">
        //                             <span>Confidence Score</span>
        //                             <span>${result.confidence}%</span>
        //                         </div>
        //                         <div class="progress-bar">
        //                             <div class="progress-fill" style="width: ${result.confidence}%;"></div>
        //                         </div>
        //                     </div>

        //                     <!-- Features -->
        //                     <div class="features">
        //                         <span>Detected Features</span>
        //                         <div class="features-tags">
        //                             ${featuresTags}
        //                         </div>
        //                     </div>
        //                 </div>
        //             </div>
        //         </div>

        //         <!-- Recommendation Alert -->
        //         <div class="alert info">
        //             <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        //                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        //             </svg>
        //             <div class="alert-content">
        //                 <h4>Recommendation</h4>
        //                 <p>${result.recommendation}</p>
        //             </div>
        //         </div>

        //         <!-- Disclaimer -->
        //         <div class="alert warning">
        //             <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        //                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        //             </svg>
        //             <div class="alert-content">
        //                 <h4>Important Disclaimer</h4>
        //                 <p>This tool is for educational purposes only and should not replace professional medical advice. Always consult a dermatologist for proper diagnosis and treatment.</p>
        //             </div>
        //         </div>
        //     `;
            
        //     resultsSection.classList.remove('hidden');
        // }
 