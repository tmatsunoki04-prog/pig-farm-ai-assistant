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

    // State
    let currentImageFile = null;
    let selectedCategories = new Set();
    let isSubmitting = false;

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

    // 文字入力でバリデーション実行
    textInput.addEventListener('input', validateForm);
    
    // 画像選択
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

    /**
     * バリデーション：文章が1文字でもあれば送信可能。画像やカテゴリは任意。
     */
    function validateForm() {
        const hasText = textInput.value.trim().length > 0;
        submitBtn.disabled = !hasText || isSubmitting;
    }

    // 結果表示後のリセット
    resetBtn.addEventListener('click', resetApp);
    
    // エラー時のリトライ
    retryBtn.addEventListener('click', () => {
        isSubmitting = false;
        validateForm();
        submitConsultation();
    });

    /**
     * 送信ボタンのクリックハンドラ
     * disabled でなければ form.requestSubmit() を呼んで submit イベントを発火させる
     */
    submitBtn.addEventListener('click', (e) => {
        if (!submitBtn.disabled && !isSubmitting) {
            console.log('Submit trigger via requestSubmit');
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                // requestSubmit未対応ブラウザ用フォールバック
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        }
    });

    /**
     * フォームの submit イベントハンドラ (Centralized)
     */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (isSubmitting || submitBtn.disabled) return;
        submitConsultation();
    });

    /**
     * AI相談送信処理の本体
     */
    async function submitConsultation() {
        if (isSubmitting) return;
        isSubmitting = true;
        validateForm(); // 即座にボタンを無効化（二重送信防止）

        inputSection.classList.add('is-hidden');
        resultArea.classList.add('is-hidden');
        statusArea.classList.remove('is-hidden');
        errorUI.classList.add('is-hidden');
        loadingUI.classList.remove('is-hidden');

        // カテゴリ情報をテキストに付加
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
            const resultData = await res.json();
            renderResult(resultData);
        } catch (error) {
            console.error('API Error:', error);
            isSubmitting = false; // エラー時はフラグを戻す
            loadingUI.classList.add('is-hidden');
            errorUI.classList.remove('is-hidden');
            errorUI.querySelector('p').textContent = error.message;
            validateForm(); // ボタン状態を再判定
        }
    }

    /**
     * 結果表示のレンダリング
     */
    function renderResult(data) {
        isSubmitting = false; // 送信完了
        statusArea.classList.add('is-hidden');
        resultArea.classList.remove('is-hidden');

        const map = {
            'high': { label: 'すぐ獣医師相談', class: 'high' },
            'medium': { label: '今日中に確認', class: 'medium' },
            'low': { label: 'まず様子確認', class: 'low' }
        };
        const config = map[data.urgency] || map['low'];
        resUrgency.textContent = config.label;
        resUrgency.className = `urgency-badge ${config.class}`;

        resVetAlert.classList.toggle('is-hidden', !data.vet_consult_needed);
        resVetMsg.textContent = data.vet_consult_message || '';
        resActions.innerHTML = (data.action_items || []).map(i => `<li>${i}</li>`).join('');
        resReason.textContent = data.reason || '特になし';
        resOptional.innerHTML = (data.optional_questions || []).map(q => `<li>${q}</li>`).join('');
        
        window.scrollTo(0, 0);
    }

    /**
     * アプリケーション状態の完全リセット
     */
    function resetApp() {
        isSubmitting = false;
        form.reset();
        currentImageFile = null;
        fileNameDisplay.textContent = '';
        selectedCategories.clear();
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('selected'));
        resultArea.classList.add('is-hidden');
        statusArea.classList.add('is-hidden');
        inputSection.classList.remove('is-hidden');
        validateForm();
        window.scrollTo(0, 0);
    }
});
