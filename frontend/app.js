document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('consult-form');
    const textInput = document.getElementById('consult-text');
    const imageInput = document.getElementById('consult-image');
    const fileNameDisplay = document.getElementById('file-name');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const retryBtn = document.getElementById('retry-btn');
    
    // Sections
    const inputSection = document.querySelector('.input-section');
    const statusArea = document.getElementById('status-area');
    const resultArea = document.getElementById('result-area');
    
    const categoryGrid = document.getElementById('category-grid');
    
    // Status elements
    const loadingUI = document.getElementById('loading');
    const errorUI = document.getElementById('error-message');
    
    // Result elements
    const resUrgency = document.getElementById('res-urgency');
    const resVetAlert = document.getElementById('res-vet-alert');
    const resVetMsg = document.getElementById('res-vet-msg');
    const resActions = document.getElementById('res-actions');
    const resReason = document.getElementById('res-reason');
    const resOptional = document.getElementById('res-optional');

    // API URL (adjust if hosted elsewhere)
    const API_URL = 'http://localhost:3000/api/consult';

    // State
    let currentImageFile = null;
    let selectedCategories = new Set();

    // --- Event Listeners ---
    
    // Category selection logic
    if (categoryGrid) {
        categoryGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-item');
            if (!btn) return;
            
            const category = btn.dataset.category;
            if (selectedCategories.has(category)) {
                selectedCategories.delete(category);
                btn.classList.remove('selected');
            } else {
                selectedCategories.add(category);
                btn.classList.add('selected');
            }
            validateForm();
        });
    }

    // Text input validation
    textInput.addEventListener('input', validateForm);

    // Image input handling
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check size (MVP limit 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('画像サイズは5MB以下にしてください。');
                imageInput.value = '';
                currentImageFile = null;
                fileNameDisplay.textContent = '';
            } else {
                currentImageFile = file;
                fileNameDisplay.textContent = file.name;
            }
        } else {
            currentImageFile = null;
            fileNameDisplay.textContent = '';
        }
        validateForm();
    });

    // Form validation logic
    function validateForm() {
        const textHasValue = textInput.value.trim().length > 0;
        const imageHasValue = currentImageFile !== null;
        const categoryHasValue = selectedCategories.size > 0;
        
        // MVP Rule: Valid if text exists OR image exists OR category selected
        submitBtn.disabled = !(textHasValue || imageHasValue || categoryHasValue);
    }

    // Reset flow
    resetBtn.addEventListener('click', resetApp);
    retryBtn.addEventListener('click', submitConsultation);

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;
        submitConsultation();
    });

    async function submitConsultation() {
        // Prepare UI
        inputSection.classList.add('hidden');
        resultArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        errorUI.classList.add('hidden');
        loadingUI.classList.remove('hidden');

        // Construct enriched text from categories and textarea
        let enrichedText = "";
        if (selectedCategories.size > 0) {
            enrichedText += `【カテゴリ: ${Array.from(selectedCategories).join(', ')}】\n`;
        }
        enrichedText += textInput.value.trim();

        // Prepare FormData
        const formData = new FormData();
        formData.append('text', enrichedText);
        if (currentImageFile) {
            formData.append('image', currentImageFile);
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            
            // Check if backend returned an application error message
            if (data.error) {
                throw new Error(data.error.message || 'Error from server');
            }

            renderResult(data);

        } catch (error) {
            console.error('API Error:', error);
            loadingUI.classList.add('hidden');
            errorUI.classList.remove('hidden');
        }
    }

    function renderResult(data) {
        // Hide loading, show results
        statusArea.classList.add('hidden');
        resultArea.classList.remove('hidden');

        // 1. Urgency Badge
        resUrgency.textContent = data.urgency;
        resUrgency.className = 'urgency-badge'; // Reset classes
        if (data.urgency.includes('すぐ') || data.urgency.includes('緊急')) {
            resUrgency.classList.add('high');
        } else if (data.urgency.includes('今日中') || data.urgency.includes('注意')) {
            resUrgency.classList.add('medium');
        } else {
            resUrgency.classList.add('low');
        }

        // 2. Vet Consult Alert
        if (data.vet_consult_needed && data.vet_consult_message) {
            resVetMsg.textContent = data.vet_consult_message;
            resVetAlert.classList.remove('hidden');
        } else {
            resVetAlert.classList.add('hidden');
        }

        // 3. Action Items
        resActions.innerHTML = '';
        if (data.action_items && data.action_items.length > 0) {
            data.action_items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                resActions.appendChild(li);
            });
        }

        // 4. Reason
        resReason.textContent = data.reason || '特になし';

        // 5. Optional Questions
        resOptional.innerHTML = '';
        if (data.optional_questions && data.optional_questions.length > 0) {
            data.optional_questions.forEach(q => {
                const li = document.createElement('li');
                li.textContent = q;
                resOptional.appendChild(li);
            });
            resOptional.parentElement.classList.remove('hidden'); // Show details block
        } else {
            resOptional.parentElement.classList.add('hidden'); // Hide details block
        }
        
        // Scroll to top of results
        window.scrollTo(0, 0);
    }

    function resetApp() {
        // Reset form
        form.reset();
        currentImageFile = null;
        fileNameDisplay.textContent = '';
        
        // Reset categories
        selectedCategories.clear();
        document.querySelectorAll('.category-item').forEach(btn => btn.classList.remove('selected'));
        
        validateForm();

        // Reset UI sections
        resultArea.classList.add('hidden');
        statusArea.classList.add('hidden');
        inputSection.classList.remove('hidden');
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
});
