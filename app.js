/**
 * PigAI Core Logic (Defensive Implementation)
 * Standardized on '.is-hidden' class
 */
console.log('PigAI app.js starting...');

const form = document.getElementById('consult-form');
const textInput = document.getElementById('consult-text');
const imageInput = document.getElementById('consult-image');
const fileNameDisplay = document.getElementById('file-name');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const retryBtn = document.getElementById('retry-btn');

const inputSection = document.querySelector('.input-section');
const statusArea = document.getElementById('status-area');
const resultArea = document.getElementById('result-area');
const categoryGrid = document.getElementById('category-grid');

const loadingUI = document.getElementById('loading');
const errorUI = document.getElementById('error-message');

const resUrgency = document.getElementById('res-urgency');
const resVetAlert = document.getElementById('res-vet-alert');
const resVetMsg = document.getElementById('res-vet-msg');
const resActions = document.getElementById('res-actions');
const resReason = document.getElementById('res-reason');
const resOptional = document.getElementById('res-optional');

// API URL - Using relative path for Vercel
const API_URL = '/api/consult';

// State Management
let currentImageFile = null;
let selectedCategories = new Set();
let isSubmitting = false;

// 1. Category Selection
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
    });
}

// 2. Input Validation (Defensive)
function validateForm() {
    const textValue = textInput ? textInput.value.trim() : "";
    const hasText = textValue.length > 0;
    
    // Disable condition: No text OR already submitting
    if (submitBtn) {
        submitBtn.disabled = !hasText || isSubmitting;
    }
}

if (textInput) {
    textInput.addEventListener('input', validateForm);
}

// 3. Image Selection
if (imageInput) {
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.size <= 5 * 1024 * 1024) {
            currentImageFile = file;
            if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        } else if (file) {
            alert('5MB以下にしてください。');
            imageInput.value = '';
            currentImageFile = null;
            if (fileNameDisplay) fileNameDisplay.textContent = '';
        }
        validateForm();
    });
}

// 4. Force Submission Logic
const handleTriggerSubmit = (e) => {
    console.log('Triggering form submission...');
    if (submitBtn && !submitBtn.disabled && !isSubmitting) {
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }
};

if (submitBtn) {
    submitBtn.addEventListener('click', handleTriggerSubmit);
}

// 5. Central Submission Logic
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Submit event validated. Starting process...');
        
        if (isSubmitting) return;
        isSubmitting = true;
        validateForm(); // Update UI immediately

        // Toggle UI visibility
        if (inputSection) inputSection.classList.add('is-hidden');
        if (resultArea) resultArea.classList.add('is-hidden');
        if (statusArea) {
            statusArea.classList.remove('is-hidden');
            if (loadingUI) loadingUI.classList.remove('is-hidden');
            if (errorUI) errorUI.classList.add('is-hidden');
        }

        // Prepare Data
        let enrichedText = selectedCategories.size > 0 ? `【カテゴリ: ${Array.from(selectedCategories).join(', ')}】\n` : "";
        enrichedText += textInput.value.trim();

        const formData = new FormData();
        formData.append('text', enrichedText);
        if (currentImageFile) formData.append('image', currentImageFile);

        try {
            console.log('Fetching API:', API_URL);
            const res = await fetch(API_URL, { method: 'POST', body: formData });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `通信エラー (${res.status})`);
            }
            
            const resultData = await res.json();
            renderResult(resultData);
        } catch (error) {
            console.error('Submission Failed:', error);
            showError(error.message);
        } finally {
            // isSubmitting reset depends on result or manual retry
        }
    });
}

// 6. Result & Error Rendering
function renderResult(data) {
    console.log('Rendering Result:', data);
    isSubmitting = false;
    
    if (statusArea) statusArea.classList.add('is-hidden');
    if (resultArea) resultArea.classList.remove('is-hidden');

    const map = {
        'high': { label: 'すぐ獣医師相談', class: 'high' },
        'medium': { label: '今日中に確認', class: 'medium' },
        'low': { label: 'まず様子確認', class: 'low' }
    };
    const config = map[data.urgency] || map['low'];

    if (resUrgency) {
        resUrgency.textContent = config.label;
        resUrgency.className = `urgency-badge ${config.class}`;
    }

    if (resVetAlert) {
        resVetAlert.classList.toggle('is-hidden', !data.vet_consult_needed);
        if (resVetMsg) resVetMsg.textContent = data.vet_consult_message || '';
    }

    if (resActions) resActions.innerHTML = (data.action_items || []).map(i => `<li>${i}</li>`).join('');
    if (resReason) resReason.textContent = data.reason || '特になし';
    if (resOptional) resOptional.innerHTML = (data.optional_questions || []).map(q => `<li>${q}</li>`).join('');

    window.scrollTo(0, 0);
}

function showError(msg) {
    isSubmitting = false;
    if (loadingUI) loadingUI.classList.add('is-hidden');
    if (errorUI) {
        errorUI.classList.remove('is-hidden');
        const errTextP = errorUI.querySelector('p');
        if (errTextP) errTextP.textContent = msg;
    }
    validateForm();
}

// 7. Reset & Utilities
function resetApp() {
    console.log('Resetting application state...');
    isSubmitting = false;
    if (form) form.reset();
    currentImageFile = null;
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    selectedCategories.clear();
    document.querySelectorAll('.category-item').forEach(b => b.classList.remove('selected'));
    
    if (resultArea) resultArea.classList.add('is-hidden');
    if (statusArea) statusArea.classList.add('is-hidden');
    if (inputSection) inputSection.classList.remove('is-hidden');
    
    validateForm();
    window.scrollTo(0, 0);
}

if (resetBtn) resetBtn.addEventListener('click', resetApp);
if (retryBtn) retryBtn.addEventListener('click', () => {
    isSubmitting = false;
    validateForm();
    if (form) form.requestSubmit();
});

// Final Init
validateForm();
console.log('PigAI app.js initialization complete.');
