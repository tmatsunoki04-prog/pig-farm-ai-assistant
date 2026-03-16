document.addEventListener('DOMContentLoaded', () => {
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

    // API URL - Vercel route
    const API_URL = '/api/consult';

    let currentImageFile = null;
    let selectedCategories = new Set();

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

    textInput.addEventListener('input', validateForm);
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.size <= 5 * 1024 * 1024) {
            currentImageFile = file;
            fileNameDisplay.textContent = file.name;
        } else if (file) {
            alert('5MB以下にしてください。');
            imageInput.value = '';
            currentImageFile = null;
            fileNameDisplay.textContent = '';
        }
        validateForm();
    });

    function validateForm() {
        // 送信条件：文章入力が1文字でもあれば有効（カテゴリ・画像は任意）
        submitBtn.disabled = textInput.value.trim().length === 0;
    }

    resetBtn.addEventListener('click', resetApp);
    retryBtn.addEventListener('click', submitConsultation);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;
        submitConsultation();
    });

    async function submitConsultation() {
        inputSection.classList.add('hidden');
        resultArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        errorUI.classList.add('hidden');
        loadingUI.classList.remove('hidden');

        let enrichedText = selectedCategories.size > 0 ? `【カテゴリ: ${Array.from(selectedCategories).join(', ')}】\n` : "";
        enrichedText += textInput.value.trim();

        const formData = new FormData();
        formData.append('text', enrichedText);
        if (currentImageFile) formData.append('image', currentImageFile);

        try {
            const res = await fetch(API_URL, { method: 'POST', body: formData });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error?.message || `通信エラー (${res.status})`);
            }
            renderResult(await res.json());
        } catch (error) {
            console.error('API Error:', error);
            loadingUI.classList.add('hidden');
            errorUI.classList.remove('hidden');
            errorUI.querySelector('p').textContent = error.message;
        }
    }

    function renderResult(data) {
        statusArea.classList.add('hidden');
        resultArea.classList.remove('hidden');

        const map = {
            'high': { label: 'すぐ獣医師相談', class: 'high' },
            'medium': { label: '今日中に確認', class: 'medium' },
            'low': { label: 'まず様子確認', class: 'low' }
        };
        const config = map[data.urgency] || map['low'];
        resUrgency.textContent = config.label;
        resUrgency.className = `urgency-badge ${config.class}`;

        resVetAlert.classList.toggle('hidden', !data.vet_consult_needed);
        resVetMsg.textContent = data.vet_consult_message || '';
        resActions.innerHTML = (data.action_items || []).map(i => `<li>${i}</li>`).join('');
        resReason.textContent = data.reason || '特になし';
        resOptional.innerHTML = (data.optional_questions || []).map(q => `<li>${q}</li>`).join('');
        window.scrollTo(0, 0);
    }

    function resetApp() {
        form.reset();
        currentImageFile = null;
        fileNameDisplay.textContent = '';
        selectedCategories.clear();
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('selected'));
        resultArea.classList.add('hidden');
        statusArea.classList.add('hidden');
        inputSection.classList.remove('hidden');
        validateForm();
        window.scrollTo(0, 0);
    }
});
