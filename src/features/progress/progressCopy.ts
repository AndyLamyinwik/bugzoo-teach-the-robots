import type { Locale } from '../../i18n';
import type { SaveStatus } from '../../progress';
import type { Stage } from '../../domain/teaching/engine';

const zh = {
  dashboard: '學習總覽',
  dashboardIntro:
    '你的教學旅程，從一個能改變推理的反例開始。繼續上次的課程，或認識下一位機器人學生。',
  passport: '學習護照',
  passportIntro:
    '記錄你用證據排除了哪些迷思，以及你與機器人是否通過未見題驗證。每一項成就都有實際課程記錄。',
  completed: '已完成課程',
  inProgress: '進行中課程',
  effective: '有效反例',
  verified: '通過未見題驗證',
  effectiveNote:
    '只計算確實排除至少一條迷思規則的正確教學示例；一般實驗、無辨識力示例與隨機抽球次數不列入。',
  courseList: '四位機器人學生',
  currentStep: '目前步驟',
  start: '開始課程',
  continue: '繼續課程',
  viewResult: '查看結果',
  viewPassport: '查看學習護照',
  viewDashboard: '返回學習總覽',
  home: '返回首頁',
  eliminated: '已排除的迷思',
  noneEliminated: '尚未排除任何迷思。',
  verification: '未見題驗證',
  verificationNotStarted: '尚未開始驗證',
  verificationPartial: '驗證進行中',
  verificationPassed: '學生與機器人均通過',
  verificationRequired: '完成條件：只剩正確規則，學生與機器人都通過三道未見題。',
  concept: '概念回顧',
  achievements: '已獲得的成就',
  noAchievements: '完成一個課程後，這裡會出現對應的成就。',
  achievementScope:
    '成就表示你完成這個課程的教學與三題驗證；它不代表已掌握所有同類題目。',
  export: '匯出 Markdown 學習護照',
  exportNote: '摘要以目前語言在瀏覽器內產生，包含實際進度與數學概念回顧。',
  exportDate: '匯出日期',
  exported: '學習護照已在瀏覽器產生，並已送出下載請求。',
  exportFailed: '此瀏覽器無法下載摘要。請確認允許下載後再試一次。',
  data: '本機資料管理',
  privacy:
    '進度只保存在這台裝置、這個瀏覽器的 localStorage，不會上傳伺服器。不需要帳號，不收集個人身分資訊。不同瀏覽器或裝置不會自動同步；清除瀏覽器資料也會移除進度。',
  saveState: '儲存狀態',
  resetLesson: '清除課程進度',
  clearAll: '清除所有學習進度',
  confirmLesson: '確定清除 {name} 的學習進度？此操作無法復原，其他課程與語言偏好會保留。',
  confirmAll: '確定清除四個課程的所有學習進度？此操作無法復原，語言偏好會保留。',
  resetDone: '已清除 {name} 的學習進度。',
  clearDone: '已清除所有課程的學習進度。',
  removalFailed:
    '已清除本次記憶體進度，但瀏覽器拒絕移除已保存資料；重新載入可能恢復舊進度。請透過瀏覽器設定清除本網站資料。',
  fallbackWarning:
    '部分課程目前只保留本次記憶體進度；重新載入可能遺失最新變更，或恢復未移除的舊資料。',
  corruptedWarning:
    '部分已保存資料無法安全還原。該課程從初始狀態開始；你可在下方清除這份資料。',
  versionWarning:
    '部分已保存資料來自不支援的版本。該課程從初始狀態開始；原始資料保留到你選擇清除。',
  notStarted: '尚未開始',
  active: '進行中',
  complete: '已完成',
  achievementEarned: '完成成就',
  reportTitle: 'BugZoo 學習護照',
  actualProgress: '實際課程進度',
  status: '狀態',
} as const;

type ProgressText = { readonly [Key in keyof typeof zh]: string };

const en: ProgressText = {
  dashboard: 'Learning dashboard',
  dashboardIntro:
    'Your teaching journey starts with a counterexample that changes a rule. Continue your lesson or meet your next robot student.',
  passport: 'Learning passport',
  passportIntro:
    'Track the misconceptions you ruled out with evidence and the unseen questions you and your robot passed. Every achievement reflects a real lesson record.',
  completed: 'Completed lessons',
  inProgress: 'Lessons in progress',
  effective: 'Effective counterexamples',
  verified: 'Lessons verified on unseen questions',
  effectiveNote:
    'Counts only correct teaching examples that eliminate at least one misconception. Experiments, non-discriminating examples, and random draws are excluded.',
  courseList: 'Your four robot students',
  currentStep: 'Current step',
  start: 'Start lesson',
  continue: 'Continue lesson',
  viewResult: 'View results',
  viewPassport: 'View learning passport',
  viewDashboard: 'Back to dashboard',
  home: 'Back to home',
  eliminated: 'Misconceptions ruled out',
  noneEliminated: 'No misconceptions have been ruled out yet.',
  verification: 'Unseen-question verification',
  verificationNotStarted: 'Verification not started',
  verificationPartial: 'Verification in progress',
  verificationPassed: 'Student and robot both passed',
  verificationRequired:
    'Completion requires only the correct rule to remain and both student and robot to pass three unseen questions.',
  concept: 'Concept recap',
  achievements: 'Earned achievements',
  noAchievements: 'Complete a lesson to earn its achievement here.',
  achievementScope:
    'An achievement records this lesson’s teaching and three-question verification. It does not establish mastery of every related problem.',
  export: 'Export Markdown learning passport',
  exportNote:
    'Your browser generates the summary in the current language, using your actual progress and a mathematical concept recap.',
  exportDate: 'Export date',
  exported:
    'Your learning passport was generated in your browser, and a download was requested.',
  exportFailed:
    'This browser could not download the summary. Allow downloads and try again.',
  data: 'Local data management',
  privacy:
    'Progress stays in localStorage on this device and browser and is not uploaded to a server. No account or personal identity information is needed or collected. Other browsers or devices do not sync automatically. Clearing browser data also removes progress.',
  saveState: 'Storage status',
  resetLesson: 'Clear lesson progress',
  clearAll: 'Clear all learning progress',
  confirmLesson:
    'Clear learning progress for {name}? This cannot be undone. Other lessons and your language preference will be kept.',
  confirmAll:
    'Clear learning progress for all four lessons? This cannot be undone. Your language preference will be kept.',
  resetDone: 'Learning progress for {name} was cleared.',
  clearDone: 'Learning progress for all lessons was cleared.',
  removalFailed:
    'Progress in memory was cleared, but the browser refused to remove saved data. Reloading may restore old progress. Clear this site’s data through your browser settings.',
  fallbackWarning:
    'Some lessons currently keep progress only in memory. Reloading may lose the latest changes or restore old data that could not be removed.',
  corruptedWarning:
    'Some saved data could not be safely restored. Those lessons start from the initial state. You can clear that data below.',
  versionWarning:
    'Some saved data uses an unsupported version. Those lessons start from the initial state. The original data stays until you choose to clear it.',
  notStarted: 'Not started',
  active: 'In progress',
  complete: 'Complete',
  achievementEarned: 'Completion achievement',
  reportTitle: 'BugZoo Learning Passport',
  actualProgress: 'Actual lesson progress',
  status: 'Status',
};

export function progressCopy(locale: Locale): ProgressText {
  return locale === 'en' ? en : zh;
}

export function stageLabel(stage: Stage, locale: Locale): string {
  const labels: Record<Stage, readonly [string, string]> = {
    observe: ['觀察', 'Observe'],
    hypothesize: ['猜想', 'Hypothesize'],
    experiment: ['實驗', 'Experiment'],
    teach: ['教學', 'Teach'],
    verify: ['驗證', 'Verify'],
    complete: ['完成', 'Complete'],
  };
  return labels[stage][locale === 'en' ? 1 : 0];
}

export function saveStatusLabel(status: SaveStatus, locale: Locale): string {
  const labels: Record<SaveStatus, readonly [string, string]> = {
    empty: ['尚無保存進度', 'No saved progress'],
    saved: ['已保存於此瀏覽器', 'Saved in this browser'],
    'memory-only': ['僅保留本次記憶體進度', 'Progress kept in memory only'],
    corrupt: ['已保存資料無法還原', 'Saved data could not be restored'],
    'unsupported-version': ['已保存資料版本不支援', 'Saved data version is unsupported'],
  };
  return labels[status][locale === 'en' ? 1 : 0];
}
