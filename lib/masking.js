// 簡易マスキングロジック（正規表現ベース）
const maskPatterns = [
  { regex: /0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}/g, replacement: '[TEL]' },
  { regex: /[a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-\.]+/g, replacement: '[EMAIL]' },
  { regex: /(?:牧場|農場)の([ぁ-んァ-ヶ一-龠]{1,5})(?:です|より)/g, replacement: '牧場の[NAME]です' },
  { regex: /お疲れ様です[。、\s]*([ぁ-んァ-ヶ一-龠]{1,5})です/g, replacement: '[挨拶省略]' }
];

function maskText(text) {
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

module.exports = { maskText };
