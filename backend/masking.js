// 簡易マスキングロジック（正規表現ベース）
// 完璧な匿名化ではなく、MVPとして「明らかに危ないものを削る」レベル。

const maskPatterns = [
  // 1. 電話番号らしき文字列 (090-1234-5678, 03-1234-5678など)
  {
    regex: /0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}/g,
    replacement: '[TEL]'
  },
  // 2. メールアドレスらしき文字列
  {
    regex: /[a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-\.]+/g,
    replacement: '[EMAIL]'
  },
  // 3. 担当者名っぽいパターン (〇〇牧場の〇〇です、〇〇担当の〇〇です)
  {
    regex: /(?:牧場|農場)の([ぁ-んァ-ヶ一-龠]{1,5})(?:です|より)/g,
    replacement: '牧場の[NAME]です'
  },
  // 4. LINE等の定型挨拶 (お疲れ様です、〇〇です)
  {
    regex: /お疲れ様です[。、\s]*([ぁ-んァ-ヶ一-龠]{1,5})です/g,
    replacement: '[挨拶省略]'
  }
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

module.exports = {
  maskText
};
