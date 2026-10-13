import type { MessageKey } from './messages';
export const reasoningTemplates = {
  'fraction.common-unit': [
    '先使用共同分母 {v0}，兩個分子分別變成 {v1} 與 {v2}。',
    ['denominator', 'leftNumerator', 'rightNumerator'],
  ],
  'fraction.add-scaled': [
    '相同大小的單位相加，得到 {v0}/{v1}。',
    ['numerator', 'denominator'],
  ],
  'fraction.add-both': [
    '直接將分子相加、分母也相加，得到 {v0}/{v1}；沒有先統一單位。',
    ['numerator', 'denominator'],
  ],
  'fraction.keep-first': [
    '直接把分子相加，保留第一個分母，得到 {v0}/{v1}；沒有換算第二個分數。',
    ['numerator', 'denominator'],
  ],
  'fraction.simplify': ['約分後的答案是 {v0}。', ['answer']],
  'discount.first-applied': [
    '原價 {v0} 元先折扣 {v1}%，留下 {v2}%，精確價格是 {v3} 元，這一步不四捨五入。',
    ['originalPrice', 'discount', 'remainingPercent', 'exactPrice'],
  ],
  'discount.second-applied': [
    '再以 {v0} 元為基準折扣 {v1}%，留下 {v2}%，精確價格是 {v3} 元。',
    ['previousExactPrice', 'discount', 'remainingPercent', 'exactPrice'],
  ],
  'discount.add-discounts': [
    '把兩次折扣直接相加：{v0}% + {v1}% = {v2}%；最多扣除 100%，所以用 {v3}% 折扣原價 {v4} 元，得到 {v5} 元，忽略了第二次的價格基準已改變。',
    [
      'firstDiscount',
      'secondDiscount',
      'summedDiscount',
      'effectiveDiscount',
      'originalPrice',
      'exactPrice',
    ],
  ],
  'discount.only-second': [
    '忽略第一次 {v0}% 折扣，只對原價 {v1} 元套用第二次 {v2}% 折扣，得到 {v3} 元。',
    ['ignoredDiscount', 'originalPrice', 'discount', 'exactPrice'],
  ],
  'discount.round-final': [
    '最後才把 {v0} 元以 half-up 四捨五入到分，付款金額是 {v1} 元。',
    ['exactPrice', 'answer'],
  ],
  'chance.first': [
    '第一球要抽到{v0}：{v1} 顆目標球，共 {v2} 顆，機率是 {v3}。',
    ['color', 'count', 'total', 'probability'],
  ],
  'chance.impossible-first': [
    '袋中沒有{v0}，第一球目標不可能發生。這個條件下第二球的條件機率不存在；整個目標序列的聯合機率是 {v1}。',
    ['color', 'answer'],
  ],
  'chance.conditional': [
    '假設第一球抽到{v0}且不放回，剩 {v1} 顆紅球、{v2} 顆藍球，共 {v3} 顆。第二球抽到{v4}的條件機率是 {v5}。',
    ['firstColor', 'red', 'blue', 'total', 'secondColor', 'probability'],
  ],
  'chance.multiply': [
    '相乘兩個步驟：{v0} × {v1} = {v2}。',
    ['first', 'second', 'answer'],
  ],
  'chance.independent': [
    '錯誤規則把兩次抽球當成獨立事件，第二球仍用原來的 {v0} 顆球計算：{v1} × {v2} = {v3}，忽略第一球已被移除。',
    ['total', 'first', 'second', 'answer'],
  ],
  'chance.second-only': [
    '錯誤規則只看第二球顏色，使用原袋 {v0}/{v1} 的{v2}比例，得到 {v3}。這是第二球單一事件的邊際機率，不能當作「第一次目標且第二次目標」的聯合機率。',
    ['count', 'total', 'color', 'answer'],
  ],
} as const satisfies Record<string, readonly [MessageKey, readonly string[]]>;
export const validationSources: Readonly<Record<string, string>> = {
  'fraction.validation.shape': '請完整填寫兩個分數與答案。',
  'fraction.validation.integer': '分子與分母必須是整數，不能使用小數或科學記號。',
  'fraction.validation.zero-denominator': '分母不能為零。',
  'fraction.validation.positive-denominator': '本課程的分母必須是正整數。',
  'fraction.validation.operand-bound': '題目分子的絕對值與分母都不能超過 1000。',
  'fraction.validation.answer-bound':
    '答案分子的絕對值與分母都不能超過 1,000,000,000,000。',
  'discount.validation.shape': '請完整填寫原價、兩次折扣與答案。',
  'discount.validation.money-format': '金額請使用整數或最多兩位小數，不能使用科學記號。',
  'discount.validation.percent-format':
    '折扣百分比請使用整數或最多兩位小數，不能使用科學記號。',
  'discount.validation.nonnegative': '原價、折扣與付款金額都不能為負數。',
  'discount.validation.money-bound': '金額必須介於 0 與 1,000,000.00 元。',
  'discount.validation.percent-bound': '每次折扣百分比必須介於 0% 與 100%。',
  'minus.validation.shape': '請完整填寫被減數與減數。',
  'minus.validation.integer': '請輸入整數；不能留空、使用小數或科學記號。',
  'minus.validation.operand-bound': '題目的兩個整數都必須介於 -20 與 20。',
  'minus.validation.answer-bound': '答案必須是介於 -40 與 40 的整數。',
  'chance.validation.shape': '請完整填寫球數、目標顏色與分數答案。',
  'chance.validation.integer':
    '球數與答案的分子、分母必須是整數字串，不能留空、使用小數或科學記號。',
  'chance.validation.ball-bound': '每種顏色的球數必須介於 0 與 10。',
  'chance.validation.total-bound': '總球數必須介於 2 與 12。',
  'chance.validation.color': '兩次目標顏色都必須選擇紅球或藍球。',
  'chance.validation.denominator': '機率分數的分母必須是正整數。',
  'chance.validation.answer-bound': '答案分子的絕對值與分母不能超過 1,000,000,000,000。',
  'chance.validation.probability':
    '機率必須介於 0 與 1；請使用非負分子，且分子不能大於分母。',
};
