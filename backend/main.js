const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { maskText } = require('./masking');

const app = express();
const PORT = process.env.PORT || 3000;

// MVP Middleware
app.use(cors());
app.use(express.json()); // For application/json requests
app.use(express.urlencoded({ extended: true }));

// Storage limits (Memory storage for images, no disk saving of raw images per MVP privacy spec)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const logFilePath = path.join(logDir, 'structured_logs.jsonl');

// Helpers
const generateId = () => `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Mock API endpoint for MVP testing
app.post('/api/consult', upload.single('image'), (req, res) => {
  try {
    const rawInput = req.body.text || '';
    const hasImage = !!req.file;

    if (!rawInput && !hasImage) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: '内容を入力するか、写真を添付してください。' }
      });
    }

    // 1. Masking logic on rawInput
    const { maskedText, isMasked } = maskText(rawInput);

    // 2. Here we would normally call the VLM/LLM using maskedText and req.file.buffer
    // For the MVP mock, we return a static response indicating success.
    
    // Mock Response Body (based on 03_AI出力JSON仕様.md)
    const mockResponse = {
      consultation_id: generateId(),
      timestamp: new Date().toISOString(),
      raw_input: rawInput, // Required for UI to echo back if needed, but NOT saved to logs
      has_image: hasImage,
      image_storage_mode: 'none',
      privacy_mask_applied: isMasked,
      concern_category: '疾病',
      suspected_factors: ['哺乳豚の下痢', '脱水症状'],
      action_items: [
        'どの舎で増えているか確認',
        '何日齢か確認',
        '死亡や元気消失があるか確認'
      ],
      urgency: 'すぐ獣医師相談',
      reason: '下痢は日齢や元気の有無で見方が大きく変わり、手遅れになると危険なため。',
      vet_consult_needed: true,
      vet_consult_message: '死亡や元気消失がある場合は早急に獣医師へ相談してください。',
      optional_questions: [
        '便の性状（水様・血便など）',
        '発生頭数',
        '直近の飼料変更有無'
      ],
      image_card_id: 'dummy_card_01'
    };

    // 3. Structured Logging (DO NOT SAVE raw_input or raw image data)
    const logEntry = { ...mockResponse };
    delete logEntry.raw_input; // Privacy Requirement: Do not save raw input
    // image buffer is inherently not saved here, it is only in memory
    
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');

    // 4. Return response to Frontend
    res.json(mockResponse);

  } catch (error) {
    console.error("Consultation Error:", error.message); // Do not log raw user input here
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました。' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('MVP Privacy constraints active: On-memory images, raw_input exclusion in logs.');
});
