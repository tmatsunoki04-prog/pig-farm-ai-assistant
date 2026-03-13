const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { maskText } = require('./masking');

const app = express();
const PORT = process.env.PORT || 3000;

const { GoogleGenAI } = require('@google/genai');

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

// Initialize Gemini SDK
// Note: Ensure the GOOGLE_GENAI_API_KEY environment variable is set.
const ai = new GoogleGenAI({});

// JSON Schema definition matching 03_AI出力JSON仕様.md (excluding the runtime fields)
const responseSchema = {
    type: "OBJECT",
    properties: {
        concern_category: {
            type: "STRING",
            description: "内部分類（疾病 / 環境 / 飼料 / 管理 / 繁殖 / 設備 / その他 のいずれか）"
        },
        suspected_factors: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "内部的な判断要素（例：「哺乳豚の下痢」など）1〜複数"
        },
        action_items: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "画面表示用：「まずやること」（1〜3項目を短く）"
        },
        urgency: {
            type: "STRING",
            description: "画面表示用：「緊急度」（すぐ獣医師相談 / 今日中に確認 / まず様子確認 など）"
        },
        reason: {
            type: "STRING",
            description: "画面表示用：「理由」（1〜2文）"
        },
        vet_consult_needed: {
            type: "BOOLEAN",
            description: "獣医師への相談が早急に必要な危険なケースかどうか"
        },
        vet_consult_message: {
            type: "STRING",
            description: "危険な場合の画面表示用：「獣医師への相談目安」（不要な場合は空文字）"
        },
        optional_questions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "画面表示用：「追加で分かれば役立つ情報」"
        }
    },
    required: ["concern_category", "suspected_factors", "action_items", "urgency", "reason", "vet_consult_needed", "vet_consult_message", "optional_questions"]
};

// Mock API endpoint for MVP testing
app.post('/api/consult', upload.single('image'), async (req, res) => {
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

    // 2. Prepare Gemini Prompt and Image
    const systemInstruction = "あなたは養豚現場の相談整理AIです。診断・治療の断定は行わず、現場判断の整理と獣医師への橋渡しを行います。ユーザーからの雑な相談テキストや写真に対し、直ぐに現場で確認すべき「まずやること（1〜3点）」と緊急度、その理由を短く返してください。危険なケース（死亡増加など）の場合は必ず獣医師相談を促してください。";
    
    let userPrompt = '';
    if (maskedText) {
        userPrompt += `相談内容: ${maskedText}\n`;
    } else {
        userPrompt += `(テキストなし。写真のみの相談です。写真から考えられるまずやることを提示してください)\n`;
    }

    const contents = [];
    if (req.file) {
        contents.push({
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        });
    }
    contents.push(userPrompt);

    // Call Gemini API using the recommended structured output configuration
    const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2, // Keep responses grounded
        }
    });

    const aiParsed = JSON.parse(aiResponse.text() || "{}");

    // 3. Construct Final Response Body (based on 03_AI出力JSON仕様.md)
    const finalResponse = {
      consultation_id: generateId(),
      timestamp: new Date().toISOString(),
      raw_input: rawInput, // IMPORTANT: Used for frontend display, but NEVER saved
      has_image: hasImage,
      image_storage_mode: 'none',
      privacy_mask_applied: isMasked,
      concern_category: aiParsed.concern_category || 'その他',
      suspected_factors: aiParsed.suspected_factors || [],
      action_items: aiParsed.action_items || ['現場状況をさらに確認する'],
      urgency: aiParsed.urgency || 'まず様子確認',
      reason: aiParsed.reason || '情報が不足しているため',
      vet_consult_needed: !!aiParsed.vet_consult_needed,
      vet_consult_message: aiParsed.vet_consult_message || '',
      optional_questions: aiParsed.optional_questions || [],
      image_card_id: 'dummy_card_01'
    };

    // 4. Structured Logging (DO NOT SAVE raw_input or raw image data)
    const logEntry = { ...finalResponse };
    delete logEntry.raw_input; // Privacy Requirement: Do not save raw input
    // image buffer is inherently not saved here, it is only in memory
    
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');

    // 5. Return response to Frontend
    res.json(finalResponse);

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
