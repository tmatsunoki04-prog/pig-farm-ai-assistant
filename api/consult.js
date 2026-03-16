const { GoogleGenAI } = require('@google/genai');
const Busboy = require('busboy');

/**
 * 送信ID生成
 */
const generateId = () => `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * マスキングパターンの定義
 */
const maskPatterns = [
  { regex: /0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}/g, replacement: '[TEL]' },
  { regex: /[a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\./g, replacement: '[EMAIL]' },
  { regex: /(?:牧場|農場)の([ぁ-んァ-ヶ一-龠]{1,5})(?:です|より)/g, replacement: '牧場の[NAME]です' },
  { regex: /お疲れ様です[。、\s]*([ぁ-んァ-ヶ一-龠]{1,5})です/g, replacement: '[挨拶省略]' }
];

function inlineMaskText(text) {
  if (!text) return { maskedText: '', isMasked: false };
  let maskedText = text;
  let isMasked = false;
  maskPatterns.forEach(({ regex, replacement }) => {
    if (regex.test(maskedText)) {
      isMasked = true;
      maskedText = maskedText.replace(regex, replacement);
    }
  });
  return { maskedText, isMasked };
}

/**
 * AI応答用のスキーマ定義 (@google/genai スタイル)
 */
const responseSchema = {
    type: "object",
    properties: {
        concern_category: { type: "string", description: "内部分類（疾病 / 環境 / 飼料 / 管理 / 繁殖 / 設備 / その他）" },
        suspected_factors: { type: "array", items: { type: "string" }, description: "内部判断要素" },
        action_items: { type: "array", items: { type: "string" }, description: "まずやること" },
        urgency: { type: "string", enum: ["high", "medium", "low"], description: "緊急度レベル" },
        reason: { type: "string", description: "理由" },
        vet_consult_needed: { type: "boolean" },
        vet_consult_message: { type: "string" },
        optional_questions: { type: "array", items: { type: "string" } }
    },
    required: ["concern_category", "suspected_factors", "action_items", "urgency", "reason", "vet_consult_needed", "vet_consult_message", "optional_questions"]
};

/**
 * Vercel Serverless Function エントリーポイント
 */
module.exports = async (req, res) => {
    // 1. APIキーの確認
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: { message: "GEMINI_API_KEYが設定されていません。" } });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        let fileBuffer = null;
        let mimeType = '';
        const filePromises = [];

        // 2. Busboyによるマルチパート解析
        await new Promise((resolve, reject) => {
            busboy.on('file', (name, file, info) => {
                mimeType = info.mimeType;
                const chunks = [];
                const p = new Promise((resFile) => {
                    file.on('data', chunk => chunks.push(chunk));
                    file.on('end', () => {
                        fileBuffer = Buffer.concat(chunks);
                        resFile();
                    });
                });
                filePromises.push(p);
            });
            busboy.on('field', (name, val) => {
                fields[name] = val;
            });
            busboy.on('finish', async () => {
                try {
                    await Promise.all(filePromises);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            busboy.on('error', reject);
            req.pipe(busboy);
        });

        const rawInput = fields.text || '';
        if (!rawInput && !fileBuffer) {
            return res.status(400).json({ error: { message: '入力内容が空です。' } });
        }

        // 3. マスキング実行
        const { maskedText, isMasked } = inlineMaskText(rawInput);

        // 4. SDK初期化 (ご指定の形式: GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }))
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        // parts配列作成 (camelCase: inlineData / mimeType)
        const parts = [];
        if (fileBuffer) {
            parts.push({
                inlineData: {
                    data: fileBuffer.toString("base64"),
                    mimeType: mimeType
                }
            });
        }
        parts.push({ text: `相談内容: ${maskedText || "(テキストなし)"}` });

        try {
            // 5. モデル呼び出し (gemini-2.5-flash / camelCase書式)
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: 'user', parts }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.2,
                    systemInstruction: "あなたは養豚現場の異変を分析するAIです。専門的かつ具体的、かつ簡潔なアドバイスを行ってください。緊急度は high/medium/low で判定してください。"
                }
            });

            // 6. 結果のパース
            const aiText = result.text();
            const aiParsed = JSON.parse(aiText);
            
            // raw_input を削除し、指定の構造を維持して返却
            const finalResponse = {
                consultation_id: generateId(),
                timestamp: new Date().toISOString(),
                privacy_mask_applied: isMasked,
                ...aiParsed
            };

            res.status(200).json(finalResponse);

        } catch (aiError) {
            console.error("AI Generation Error:", aiError);
            res.status(500).json({ error: { message: `AI処理エラー: ${aiError.message}` } });
        }

    } catch (topError) {
        console.error("Backend Error:", topError);
        res.status(500).json({ error: { message: `サーバー処理エラー: ${topError.message}` } });
    }
};
