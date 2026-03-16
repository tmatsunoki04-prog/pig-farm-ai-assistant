const { GoogleGenAI } = require('@google/genai');
const Busboy = require('busboy');
const { maskText } = require('../lib/masking');

const generateId = () => `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

const responseSchema = {
    type: "OBJECT",
    properties: {
        concern_category: { type: "STRING", description: "内部分類（疾病 / 環境 / 飼料 / 管理 / 繁殖 / 設備 / その他）" },
        suspected_factors: { type: "ARRAY", items: { type: "STRING" }, description: "内部判断要素" },
        action_items: { type: "ARRAY", items: { type: "STRING" }, description: "まずやること" },
        urgency: { type: "STRING", enum: ["high", "medium", "low"], description: "緊急度レベル" },
        reason: { type: "STRING", description: "理由" },
        vet_consult_needed: { type: "BOOLEAN" },
        vet_consult_message: { type: "STRING" },
        optional_questions: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: ["concern_category", "suspected_factors", "action_items", "urgency", "reason", "vet_consult_needed", "vet_consult_message", "optional_questions"]
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: { message: 'Method Not Allowed' } });
        return;
    }

    try {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        let fileBuffer = null;
        let mimeType = '';

        await new Promise((resolve, reject) => {
            busboy.on('file', (name, file, info) => {
                mimeType = info.mimeType;
                const chunks = [];
                file.on('data', chunk => chunks.push(chunk));
                file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
            });
            busboy.on('field', (name, val) => { fields[name] = val; });
            busboy.on('finish', resolve);
            busboy.on('error', reject);
            req.pipe(busboy);
        });

        const rawInput = fields.text || '';
        if (!rawInput && !fileBuffer) {
            return res.status(400).json({ error: { message: '相談内容を入力するか写真を添付してください。' } });
        }

        const { maskedText, isMasked } = maskText(rawInput);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const contents = [];
        if (fileBuffer) {
            contents.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType: mimeType } });
        }
        contents.push({ text: `相談内容: ${maskedText || "(テキストなし)"}` });

        const result = await model.generateContent({
            contents,
            generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.2 },
            systemInstruction: "あなたは養豚現場の相談整理AIです。まずやることは1〜3項目。緊急度はhigh/medium/lowのいずれかで返してください。"
        });

        const aiParsed = JSON.parse(result.response.text());
        const finalResponse = {
            consultation_id: generateId(),
            timestamp: new Date().toISOString(),
            raw_input: rawInput,
            privacy_mask_applied: isMasked,
            ...aiParsed
        };

        console.log("CONSULT_LOG:", JSON.stringify({ ...finalResponse, raw_input: "[REDACTED]" }));
        res.status(200).json(finalResponse);

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: { message: 'サーバーエラーが発生しました。' } });
    }
};
