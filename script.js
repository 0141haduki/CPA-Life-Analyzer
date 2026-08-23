// Life Growth Analyzer v10.0

console.log("Life Growth Analyzer v10.0 起動");

const STORAGE_KEY = "CPA_LIFE_ANALYZER_RECORDS_V2";
const LAST_DATE_KEY = "CPA_LIFE_ANALYZER_LAST_DATE_V2";
const SETTINGS_KEY = "CPA_LIFE_ANALYZER_SETTINGS_V2";

const SUBJECTS_KEY = "LIFE_GROWTH_ANALYZER_SUBJECTS_V2";
const OLD_SUBJECTS_KEY = "LIFE_GROWTH_ANALYZER_SUBJECTS_V1";
const GOAL_KEY = "LIFE_GROWTH_ANALYZER_GOAL_V1";

const HABITS_KEY = "LIFE_GROWTH_ANALYZER_HABITS_V1";
const HABIT_RECORDS_KEY = "LIFE_GROWTH_ANALYZER_HABIT_RECORDS_V1";

const SCHEDULE_KEY = "LIFE_GROWTH_ANALYZER_SCHEDULE_V1";
const TASKS_KEY = "LIFE_GROWTH_ANALYZER_TASKS_V1";
const SCHEDULE_TEMPLATES_KEY = "LIFE_GROWTH_ANALYZER_SCHEDULE_TEMPLATES_V1";
const ONBOARDING_KEY = "LIFE_GROWTH_ANALYZER_ONBOARDING_V1";

const defaultSubjectConfigs = [];
const defaultHabits = [];
const defaultScheduleTemplates = [];

const fieldIds = [
    "plannedBedtime",
    "plannedWakeTime",
    "bedtime",
    "wakeTime",
    "sleepHours",
    "napMinutes",
    "mood",
    "sleepiness",
    "fatigue",
    "focus",
    "studyTotal",
    "mainSubject",
    "subSubject",
    "memo",
    "selfScore",
    "lowScoreReason",
    "tomorrowAction",
    "tomorrowActionAdded",
    "morningCheckedAt",
    "nightCheckedAt",

    // 互換性維持。画面には基本表示しない。
    "awakeCount",
    "workType"
];

const ratingFields = [
    { id: "mood", label: "起床後の気分" },
    { id: "sleepiness", label: "起床後の眠気" },
    { id: "fatigue", label: "起床後の疲労" },
    { id: "focus", label: "集中できそう感" }
];

let currentDate = "";
let scheduleFocusDate = "";
let historyFilter = "7";
let habitFilter = "all";
let activeConditionChartKey = "";
let currentPageId = "morningPage";
let activeAnalysisSectionId = "analysisWeekly";
let pendingImportData = null;
let pendingImportFileName = "";

// ==============================
// 共通
// ==============================

function $(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

function safeJsonParse(text, fallback) {
    if (!text) return fallback;
    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("JSON読み込み失敗", error);
        return fallback;
    }
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCurrentTimeString() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateStringToDate(dateText) {
    const p = String(dateText || "").split("-").map(Number);
    if (p.length !== 3) return null;
    return new Date(p[0], p[1] - 1, p[2]);
}

function dateToString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateText, days) {
    const d = dateStringToDate(dateText);
    if (!d) return dateText;
    d.setDate(d.getDate() + days);
    return dateToString(d);
}

function getRecentDates(days) {
    const today = getTodayString();
    const result = [];
    for (let i = days - 1; i >= 0; i--) result.push(addDays(today, -i));
    return result;
}

function getDaysDiff(dateText) {
    const today = dateStringToDate(getTodayString());
    const target = dateStringToDate(dateText);
    if (!today || !target) return 99999;
    return Math.floor((today - target) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateText) {
    const p = String(dateText || "").split("-");
    if (p.length !== 3) return dateText;
    return `${Number(p[1])}/${Number(p[2])}`;
}

function getMonthString(dateText) {
    return String(dateText || getTodayString()).slice(0, 7);
}

function getDatesInMonth(monthText) {
    if (!monthText || !/^\d{4}-\d{2}$/.test(monthText)) return [];
    const [year, month] = monthText.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const dates = [];
    for (let day = 1; day <= lastDay; day++) {
        dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    return dates;
}

function getWeekdayNumber(dateText) {
    const d = dateStringToDate(dateText);
    return d ? d.getDay() : null;
}

function getNumberOrNull(value) {
    if (value === "" || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

function averageNumber(values) {
    const valid = values.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function averageText(values, unit) {
    const avg = averageNumber(values);
    if (avg === null) return "未計算";
    if (unit === "%") return `${avg.toFixed(1)}%`;
    if (unit === "時間") return `${avg.toFixed(1)}時間`;
    if (unit === "分") return `${Math.round(avg)}分`;
    return avg.toFixed(1);
}

function valueOrDash(value) {
    return value === undefined || value === null || value === "" ? "未入力" : value;
}

function normalizeTime(text) {
    const raw = String(text || "").trim();
    if (/^\d{1,2}$/.test(raw)) return `${String(Number(raw)).padStart(2, "0")}:00`;
    if (/^\d{1,2}:\d{2}$/.test(raw)) {
        const [h, m] = raw.split(":");
        return `${String(Number(h)).padStart(2, "0")}:${m}`;
    }
    return "";
}

function formatMinutesAsHourMinute(minutes) {
    const n = getNumberOrNull(minutes);
    if (n === null || n <= 0) return "0分";
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
}

function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

// ==============================
// ページ
// ==============================

function showPage(pageId) {
    const target = $(pageId);
    if (!target) return;

    currentPageId = pageId;

    document.querySelectorAll(".app-page").forEach(page => {
        page.classList.toggle("active-page", page.id === pageId);
    });

    document.querySelectorAll(".page-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.pageTarget === pageId);
    });

    updateOnboardingByPage(pageId);
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "analysisPage") setTimeout(updateCharts, 80);
    if (pageId === "nightPage") updateNightTimingMessage();
}

function setupPageTabs() {
    document.querySelectorAll(".page-tab, .page-jump-button").forEach(button => {
        button.addEventListener("click", () => {
            const pageId = button.dataset.pageTarget;
            if (pageId) showPage(pageId);
        });
    });
}

function showAnalysisSection(sectionId) {
    if (!$(sectionId)) return;

    activeAnalysisSectionId = sectionId;

    document.querySelectorAll(".analysis-section").forEach(section => {
        section.classList.toggle("active-analysis-section", section.id === sectionId);
    });

    document.querySelectorAll(".analysis-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.analysisTarget === sectionId);
    });

    setTimeout(updateCharts, 80);
}

function setupAnalysisTabs() {
    document.querySelectorAll(".analysis-tab").forEach(button => {
        button.addEventListener("click", () => {
            const target = button.dataset.analysisTarget;
            if (target) showAnalysisSection(target);
        });
    });
}

// ==============================
// ストレージ
// ==============================

function getRecords() {
    const records = safeJsonParse(localStorage.getItem(STORAGE_KEY), {});
    if (!records || typeof records !== "object" || Array.isArray(records)) return {};
    return records;
}

function setRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getSettings() {
    const s = safeJsonParse(localStorage.getItem(SETTINGS_KEY), {});
    return {
        defaultPlannedBedtime: s.defaultPlannedBedtime || "",
        defaultPlannedWakeTime: s.defaultPlannedWakeTime || ""
    };
}

function setSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getGoal() {
    const g = safeJsonParse(localStorage.getItem(GOAL_KEY), {});
    return {
        title: g.title || "",
        reason: g.reason || "",
        priorityItem: g.priorityItem || "",
        minimumMinutes: g.minimumMinutes || "",
        standardMinutes: g.standardMinutes || ""
    };
}

function setGoal(goal) {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

function getOnboarding() {
    const o = safeJsonParse(localStorage.getItem(ONBOARDING_KEY), {});
    return {
        openedSettings: o.openedSettings === true,
        openedSchedule: o.openedSchedule === true,
        completed: o.completed === true
    };
}

function setOnboarding(data) {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
}

function updateOnboardingByPage(pageId) {
    const o = getOnboarding();

    if (pageId === "settingsPage") o.openedSettings = true;
    if (pageId === "schedulePage") o.openedSchedule = true;

    o.completed = o.openedSettings && o.openedSchedule;
    setOnboarding(o);
    renderOnboarding();
}

function renderOnboarding() {
    const card = $("onboardingCard");
    const status = $("onboardingStatus");
    const o = getOnboarding();

    if (card) card.style.display = o.completed ? "none" : "";

    if (status) {
        const settings = o.openedSettings ? "設定：確認済み" : "設定：未確認";
        const schedule = o.openedSchedule ? "予定：確認済み" : "予定：未確認";
        status.textContent = `${settings} / ${schedule}`;
    }
}

// ==============================
// 時間計算
// ==============================

function timeToMinutes(timeText) {
    if (!timeText) return null;
    const p = String(timeText).split(":");
    if (p.length !== 2) return null;
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function calculateTimeInBedHours(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null) return null;
    let diff = end - start;
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
}

function calculateMinutesBetween(startTime, endTime) {
    const hours = calculateTimeInBedHours(startTime, endTime);
    return hours === null ? null : Math.round(hours * 60);
}

function isNextDaySleep(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null) return false;
    return end <= start;
}

function formatTimeWithNextDay(startTime, endTime) {
    if (!endTime) return "未入力";
    return isNextDaySleep(startTime, endTime) ? `${endTime}（翌日）` : endTime;
}

function calculateClockGapMinutes(plannedTime, actualTime) {
    const planned = timeToMinutes(plannedTime);
    const actual = timeToMinutes(actualTime);
    if (planned === null || actual === null) return null;

    let diff = actual - planned;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    return diff;
}

function formatGapMinutes(minutes) {
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "未計算";
    const n = Math.round(minutes);
    if (n === 0) return "±0分";
    const sign = n > 0 ? "+" : "-";
    const abs = Math.abs(n);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (h === 0) return `${sign}${m}分`;
    if (m === 0) return `${sign}${h}時間`;
    return `${sign}${h}時間${m}分`;
}

function calculateSleepEfficiencyFromRecord(record) {
    if (!record) return null;
    const bed = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const sleep = getNumberOrNull(record.sleepHours);
    if (bed === null || sleep === null || bed <= 0 || sleep <= 0) return null;
    return sleep / bed * 100;
}

function calculateAchievementFromRecord(record) {
    if (!record) return null;
    const bedtimeGap = calculateClockGapMinutes(record.plannedBedtime, record.bedtime);
    const wakeTimeGap = calculateClockGapMinutes(record.plannedWakeTime, record.wakeTime);
    const planned = calculateTimeInBedHours(record.plannedBedtime, record.plannedWakeTime);
    const actual = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const timeInBedGap = planned !== null && actual !== null ? Math.round((actual - planned) * 60) : null;

    return {
        bedtimeGap,
        wakeTimeGap,
        timeInBedGap,
        canJudgeAchievement: bedtimeGap !== null && wakeTimeGap !== null,
        achieved: bedtimeGap !== null && wakeTimeGap !== null && Math.abs(bedtimeGap) <= 30 && Math.abs(wakeTimeGap) <= 30
    };
}

function setSummaryClass(el, value, type) {
    if (!el) return;
    el.classList.remove("good", "warning", "danger");

    if (value === null || value === undefined || Number.isNaN(value)) return;

    if (type === "gap") {
        const abs = Math.abs(value);
        if (abs <= 15) el.classList.add("good");
        else if (abs <= 60) el.classList.add("warning");
        else el.classList.add("danger");
    }

    if (type === "achievement") {
        if (value >= 70) el.classList.add("good");
        else if (value >= 40) el.classList.add("warning");
        else el.classList.add("danger");
    }

    if (type === "score") {
        if (value >= 75) el.classList.add("good");
        else if (value >= 40) el.classList.add("warning");
        else el.classList.add("danger");
    }
}

function updateSleepSummary() {
    const r = getFormData();
    const planned = calculateTimeInBedHours(r.plannedBedtime, r.plannedWakeTime);
    const actual = calculateTimeInBedHours(r.bedtime, r.wakeTime);
    const efficiency = calculateSleepEfficiencyFromRecord(r);
    const ach = calculateAchievementFromRecord(r);

    setText("plannedTimeInBed", planned === null ? "未計算" : `${planned.toFixed(1)}時間`);
    setText("timeInBed", actual === null ? "未計算" : `${actual.toFixed(1)}時間`);

    const effEl = $("sleepEfficiency");
    if (effEl) {
        effEl.classList.remove("good", "warning", "danger");
        if (efficiency === null) effEl.textContent = "未計算";
        else if (efficiency > 100) {
            effEl.textContent = `${efficiency.toFixed(1)}% 要確認`;
            effEl.classList.add("danger");
        } else if (efficiency < 70) {
            effEl.textContent = `${efficiency.toFixed(1)}% 低め`;
            effEl.classList.add("warning");
        } else {
            effEl.textContent = `${efficiency.toFixed(1)}%`;
            effEl.classList.add("good");
        }
    }

    const items = [
        ["timeInBedGap", ach ? ach.timeInBedGap : null],
        ["bedtimeGap", ach ? ach.bedtimeGap : null],
        ["wakeTimeGap", ach ? ach.wakeTimeGap : null]
    ];

    items.forEach(([id, value]) => {
        const el = $(id);
        if (!el) return;
        el.textContent = formatGapMinutes(value);
        setSummaryClass(el, value, "gap");
    });
}

function updateNightTimingMessage() {
    const el = $("nightTimingMessage");
    if (!el) return;

    const plannedBedtime = $("plannedBedtime")?.value || getSettings().defaultPlannedBedtime;

    el.classList.remove("good", "warning", "danger");

    if (!plannedBedtime) {
        el.textContent = "予定就寝時刻を入力すると判定します。";
        return;
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let bedMin = timeToMinutes(plannedBedtime);
    if (bedMin === null) {
        el.textContent = "予定就寝時刻を確認してください。";
        return;
    }

    let diff = bedMin - nowMin;
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;

    if (diff >= 90) {
        el.textContent = `就寝予定まで約${diff}分です。夜チェックには少し早めですが、済ませても構いません。`;
        el.classList.add("good");
    } else if (diff >= 60) {
        el.textContent = `就寝予定まで約${diff}分です。夜チェックにちょうどよい時間です。`;
        el.classList.add("good");
    } else if (diff >= 30) {
        el.textContent = `就寝予定まで約${diff}分です。短く入力して、早めにスマホを閉じてください。`;
        el.classList.add("warning");
    } else if (diff >= 0) {
        el.textContent = `就寝予定まで約${diff}分です。寝る直前です。必要最低限だけ記録してください。`;
        el.classList.add("danger");
    } else {
        el.textContent = "予定就寝時刻を過ぎています。今日は最低限だけにして、残りは翌朝でも構いません。";
        el.classList.add("danger");
    }
}

// ==============================
// 取り組み項目
// ==============================

function normalizeSubjectConfigs(raw) {
    if (!Array.isArray(raw)) return cloneData(defaultSubjectConfigs);

    if (raw.length === 0) return [];

    if (typeof raw[0] === "string") {
        return raw.map(name => String(name).trim())
            .filter(Boolean)
            .map(name => ({ name, subSubjects: [] }));
    }

    return raw.map(item => {
        if (!item) return null;
        const name = String(item.name || "").trim();
        if (!name) return null;
        const subSubjects = Array.isArray(item.subSubjects)
            ? item.subSubjects.map(s => String(s).trim()).filter(Boolean)
            : [];
        return { name, subSubjects: [...new Set(subSubjects)] };
    }).filter(Boolean);
}

function getSubjectConfigs() {
    const current = localStorage.getItem(SUBJECTS_KEY);
    if (current) return normalizeSubjectConfigs(safeJsonParse(current, []));

    const old = localStorage.getItem(OLD_SUBJECTS_KEY);
    if (old) {
        const migrated = normalizeSubjectConfigs(safeJsonParse(old, []));
        setSubjectConfigs(migrated);
        return migrated;
    }

    setSubjectConfigs([]);
    return [];
}

function setSubjectConfigs(configs) {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(normalizeSubjectConfigs(configs)));
}

function getSubjectNames() {
    return getSubjectConfigs().map(x => x.name);
}

function getSubSubjectsFor(parentName) {
    const found = getSubjectConfigs().find(x => x.name === parentName);
    return found ? found.subSubjects : [];
}

function fillSelect(selectId, values, selectedValue, emptyLabel) {
    const select = $(selectId);
    if (!select) return;

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    select.appendChild(empty);

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    if (selectedValue && !values.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";
}

function updateSubjectSelectOptions(selectedValue) {
    fillSelect("mainSubject", getSubjectNames(), selectedValue, "未選択");
    updateSubSubjectSelectOptions($("subSubject")?.value || "");
}

function updateSubSubjectSelectOptions(selectedValue) {
    fillSelect("subSubject", getSubSubjectsFor($("mainSubject")?.value || ""), selectedValue, "未選択");
}

function updateGoalPriorityOptions(selectedValue) {
    fillSelect("goalPriorityItem", getSubjectNames(), selectedValue, "未選択");
}

function updateScheduleLinkedSubjectOptions(selectedValue) {
    fillSelect("scheduleLinkedSubject", getSubjectNames(), selectedValue, "関連なし");
    updateScheduleLinkedSubSubjectOptions($("scheduleLinkedSubSubject")?.value || "");
}

function updateScheduleLinkedSubSubjectOptions(selectedValue) {
    fillSelect("scheduleLinkedSubSubject", getSubSubjectsFor($("scheduleLinkedSubject")?.value || ""), selectedValue, "関連なし");
}

function loadSubjectsToUI() {
    const configs = getSubjectConfigs();
    setSubjectConfigs(configs);

    updateSubjectSelectOptions($("mainSubject")?.value || "");
    updateSubSubjectSelectOptions($("subSubject")?.value || "");
    updateGoalPriorityOptions(getGoal().priorityItem);
    updateScheduleLinkedSubjectOptions($("scheduleLinkedSubject")?.value || "");
    updateScheduleLinkedSubSubjectOptions($("scheduleLinkedSubSubject")?.value || "");
    renderSubjectSettingsList();
}

function addSubject() {
    const input = $("newSubjectName");
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
        alert("追加する親項目名を入力してください。");
        return;
    }

    const configs = getSubjectConfigs();
    if (configs.some(x => x.name === name)) {
        alert("同じ親項目名がすでにあります。");
        return;
    }

    configs.push({ name, subSubjects: [] });
    setSubjectConfigs(configs);
    input.value = "";
    loadSubjectsToUI();
    updateAllDisplays();
}

function deleteSubject(subjectName) {
    if (!confirm(`「${subjectName}」を削除しますか？\n過去の記録データは削除されません。`)) return;
    setSubjectConfigs(getSubjectConfigs().filter(x => x.name !== subjectName));
    loadSubjectsToUI();
    updateAllDisplays();
}

function addSubSubject(parentName, input) {
    if (!input) return;
    const subName = input.value.trim();
    if (!subName) return;

    const configs = getSubjectConfigs();
    const parent = configs.find(x => x.name === parentName);
    if (!parent) return;

    if (parent.subSubjects.includes(subName)) {
        alert("同じ子項目名がすでにあります。");
        return;
    }

    parent.subSubjects.push(subName);
    setSubjectConfigs(configs);
    input.value = "";
    loadSubjectsToUI();
    updateAllDisplays();
}

function deleteSubSubject(parentName, subName) {
    if (!confirm(`「${parentName}」の子項目「${subName}」を削除しますか？`)) return;

    const configs = getSubjectConfigs();
    const parent = configs.find(x => x.name === parentName);
    if (!parent) return;

    parent.subSubjects = parent.subSubjects.filter(x => x !== subName);
    setSubjectConfigs(configs);
    loadSubjectsToUI();
    updateAllDisplays();
}

function renderSubjectSettingsList() {
    const list = $("subjectSettingsList");
    if (!list) return;

    const configs = getSubjectConfigs();
    list.innerHTML = "";

    if (configs.length === 0) {
        list.innerHTML = `<p class="empty">取り組み項目はまだありません。必要な親項目を追加してください。</p>`;
        return;
    }

    configs.forEach(config => {
        const item = document.createElement("div");
        item.className = "subject-setting-item";

        const subListHtml = config.subSubjects.length === 0
            ? `<p class="empty">子項目は未設定です。</p>`
            : config.subSubjects.map(sub => `
                <div class="subsubject-item">
                    <span class="subsubject-name">${escapeHtml(sub)}</span>
                    <button type="button" class="subsubject-delete-button" data-parent="${escapeHtml(config.name)}" data-sub="${escapeHtml(sub)}">削除</button>
                </div>
            `).join("");

        item.innerHTML = `
            <div class="subject-setting-main">
                <span class="subject-setting-name">${escapeHtml(config.name)}</span>
                <button type="button" class="subject-delete-button" data-subject="${escapeHtml(config.name)}">親項目を削除</button>
            </div>
            <div class="subsubject-box">
                <div class="subsubject-list">${subListHtml}</div>
                <div class="subsubject-input-row">
                    <input type="text" placeholder="例：テキスト、問題集、動画、復習">
                    <button type="button" class="subsubject-add-button">子項目追加</button>
                </div>
            </div>
        `;

        const input = item.querySelector(".subsubject-input-row input");
        const addButton = item.querySelector(".subsubject-add-button");
        addButton.addEventListener("click", () => addSubSubject(config.name, input));
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                addSubSubject(config.name, input);
            }
        });

        item.querySelector(".subject-delete-button").addEventListener("click", () => deleteSubject(config.name));

        item.querySelectorAll(".subsubject-delete-button").forEach(button => {
            button.addEventListener("click", () => deleteSubSubject(button.dataset.parent, button.dataset.sub));
        });

        list.appendChild(item);
    });
}

// ==============================
// 継続項目
// ==============================

function normalizeHabits(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
        if (!item) return null;
        const name = String(item.name || "").trim();
        if (!name) return null;
        return {
            id: item.id || createId("habit"),
            name,
            type: item.type === "avoid" ? "avoid" : "action",
            frequency: item.frequency || "daily",
            weeklyTarget: Number(item.weeklyTarget || 0),
            weekdays: Array.isArray(item.weekdays) ? item.weekdays.map(Number).filter(n => n >= 0 && n <= 6) : [],
            createdAt: item.createdAt || new Date().toISOString()
        };
    }).filter(Boolean);
}

function getHabits() {
    const stored = localStorage.getItem(HABITS_KEY);
    if (!stored) {
        setHabits([]);
        return [];
    }
    return normalizeHabits(safeJsonParse(stored, []));
}

function setHabits(habits) {
    localStorage.setItem(HABITS_KEY, JSON.stringify(normalizeHabits(habits)));
}

function getHabitRecords() {
    const r = safeJsonParse(localStorage.getItem(HABIT_RECORDS_KEY), {});
    if (!r || typeof r !== "object" || Array.isArray(r)) return {};
    return r;
}

function setHabitRecords(records) {
    localStorage.setItem(HABIT_RECORDS_KEY, JSON.stringify(records));
}

function getHabitResult(date, habitId) {
    const r = getHabitRecords();
    if (!r[date] || !r[date][habitId]) return null;
    return r[date][habitId].result === true;
}

function setHabitResult(date, habitId, result) {
    const r = getHabitRecords();
    if (!r[date]) r[date] = {};
    r[date][habitId] = { result, updatedAt: new Date().toISOString() };
    setHabitRecords(r);
    updateAllDisplays();
}

function clearHabitResult(date, habitId) {
    const r = getHabitRecords();
    if (r[date] && r[date][habitId]) delete r[date][habitId];
    setHabitRecords(r);
    updateAllDisplays();
}

function getHabitState(date, habitId) {
    const result = getHabitResult(date, habitId);
    if (result === true) return "done";
    if (result === false) return "failed";
    return "pending";
}

function getHabitFrequencyText(habit) {
    if (habit.frequency === "weekly_count") return `週${habit.weeklyTarget || 1}回`;
    if (habit.frequency === "weekday") {
        const labels = ["日", "月", "火", "水", "木", "金", "土"];
        return `曜日指定：${habit.weekdays.length ? habit.weekdays.map(d => labels[d]).join("・") : "未指定"}`;
    }
    return "毎日";
}

function isHabitDueOnDate(habit, date) {
    if (habit.frequency !== "weekday") return true;
    const weekday = getWeekdayNumber(date);
    if (weekday === null || habit.weekdays.length === 0) return true;
    return habit.weekdays.includes(weekday);
}

function getHabitStreakUntil(date, habitId) {
    let count = 0;
    let cursor = date;
    for (let i = 0; i < 1000; i++) {
        if (getHabitResult(cursor, habitId) === true) {
            count++;
            cursor = addDays(cursor, -1);
        } else break;
    }
    return count;
}

function getHabitAchievementRate(habitId, days) {
    const dates = getRecentDates(days);
    const achieved = dates.filter(d => getHabitResult(d, habitId) === true).length;
    return { achieved, recorded: dates.length, rate: days === 0 ? 0 : achieved / days * 100 };
}

function getHabitWeeklyProgress(habit, date) {
    const end = dateStringToDate(date);
    if (!end) return { achieved: 0, target: habit.weeklyTarget || 1, rate: 0 };

    const start = new Date(end);
    start.setDate(start.getDate() - start.getDay());

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(dateToString(d));
    }

    const achieved = dates.filter(d => getHabitResult(d, habit.id) === true).length;
    const target = habit.frequency === "weekly_count" ? Math.max(1, Number(habit.weeklyTarget || 1)) : dates.length;

    return { achieved, target, rate: Math.min(100, achieved / target * 100) };
}

function getHabitAchievementCount(date) {
    return getHabits().filter(h => getHabitResult(date, h.id) === true).length;
}

function getHabitPendingCount(date) {
    return getHabits().filter(h => isHabitDueOnDate(h, date) && getHabitResult(date, h.id) === null).length;
}

function updateHabitTodaySummary(date) {
    const habits = getHabits();
    const done = getHabitAchievementCount(date);
    const pending = getHabitPendingCount(date);
    let topStreak = 0;

    habits.forEach(h => topStreak = Math.max(topStreak, getHabitStreakUntil(date, h.id)));

    setText("habitTodayDoneCount", `${done}件`);
    setText("habitTodayPendingCount", `${pending}件`);
    setText("habitTodayTopStreak", topStreak > 0 ? `${topStreak}日` : "なし");
}

function shouldShowHabitByFilter(date, habit) {
    const state = getHabitState(date, habit.id);
    if (habitFilter === "all") return true;
    return state === habitFilter;
}

function getHabitStatusText(habit, date) {
    const result = getHabitResult(date, habit.id);
    const streak = getHabitStreakUntil(date, habit.id);

    if (!isHabitDueOnDate(habit, date)) return "今日は曜日指定の対象外です。必要なら記録できます。";
    if (habit.frequency === "weekly_count") {
        const p = getHabitWeeklyProgress(habit, date);
        if (result === true) return `今日達成済み。今週 ${p.achieved}/${p.target} 回です。`;
        if (result === false) return habit.type === "avoid" ? "今日は途切れた記録です。" : "今日は未達成の記録です。";
        return `今週 ${p.achieved}/${p.target} 回。今日実行すると進捗が増えます。`;
    }

    if (result === true) return `今日達成済み。現在 ${streak}日継続中。`;
    if (result === false) return habit.type === "avoid" ? "今日は途切れた記録です。" : "今日は未達成の記録です。";

    const yesterdayStreak = getHabitStreakUntil(addDays(date, -1), habit.id);
    return yesterdayStreak > 0
        ? `昨日まで ${yesterdayStreak}日継続中。今日もできたら継続です。`
        : "今日の記録はまだありません。";
}

function renderTodayHabitList() {
    const list = $("todayHabitList");
    if (!list) return;

    const date = $("recordDate")?.value || getTodayString();
    const habits = getHabits();
    updateHabitTodaySummary(date);

    list.innerHTML = "";

    if (habits.length === 0) {
        list.innerHTML = `<p class="empty">継続項目はまだありません。設定ページで追加してください。</p>`;
        return;
    }

    const visible = habits.filter(h => shouldShowHabitByFilter(date, h));
    if (visible.length === 0) {
        list.innerHTML = `<p class="empty">この条件に当てはまる継続項目はありません。</p>`;
        return;
    }

    visible.forEach(habit => {
        const result = getHabitResult(date, habit.id);
        const state = getHabitState(date, habit.id);
        const typeText = habit.type === "avoid" ? "回避型" : "実行型";
        const typeClass = habit.type === "avoid" ? "avoid" : "action";
        const streak = getHabitStreakUntil(date, habit.id);
        const rate7 = getHabitAchievementRate(habit.id, 7);
        const rate30 = getHabitAchievementRate(habit.id, 30);

        const item = document.createElement("div");
        item.className = `today-habit-item ${state}`;
        item.innerHTML = `
            <div class="today-habit-header">
                <span class="today-habit-name">${escapeHtml(habit.name)}</span>
                <div>
                    <span class="today-habit-type ${typeClass}">${typeText}</span>
                    <span class="habit-frequency-pill">${escapeHtml(getHabitFrequencyText(habit))}</span>
                </div>
            </div>
            <p class="today-habit-status">${escapeHtml(getHabitStatusText(habit, date))}</p>
            <div class="today-habit-meta">
                <span class="habit-meta-pill">現在${streak}日</span>
                <span class="habit-meta-pill">7日${rate7.rate.toFixed(0)}%</span>
                <span class="habit-meta-pill">30日${rate30.rate.toFixed(0)}%</span>
            </div>
            <div class="habit-button-row">
                <button type="button" class="habit-action-button ${result === true ? "done" : ""}" data-habit-success="${habit.id}">
                    ${result === true ? "達成済み" : habit.type === "avoid" ? "継続" : "実行"}
                </button>
                ${
                    result === true
                        ? `<button type="button" class="habit-action-button break" data-habit-clear="${habit.id}">取消</button>`
                        : `<button type="button" class="habit-action-button break" data-habit-fail="${habit.id}">${habit.type === "avoid" ? "途切れた" : "未達成"}</button>`
                }
            </div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll("[data-habit-success]").forEach(b => b.addEventListener("click", () => setHabitResult(date, b.dataset.habitSuccess, true)));
    list.querySelectorAll("[data-habit-fail]").forEach(b => b.addEventListener("click", () => setHabitResult(date, b.dataset.habitFail, false)));
    list.querySelectorAll("[data-habit-clear]").forEach(b => b.addEventListener("click", () => clearHabitResult(date, b.dataset.habitClear)));
}

function getSelectedHabitWeekdays() {
    return Array.from(document.querySelectorAll(".habit-weekday-checkbox:checked"))
        .map(input => Number(input.value))
        .filter(v => v >= 0 && v <= 6);
}

function addHabit() {
    const nameInput = $("newHabitName");
    const typeSelect = $("newHabitType");
    const frequencySelect = $("newHabitFrequency");
    const weeklyTargetInput = $("newHabitWeeklyTarget");

    if (!nameInput || !typeSelect || !frequencySelect) return;

    const name = nameInput.value.trim();
    const type = typeSelect.value === "avoid" ? "avoid" : "action";
    const frequency = frequencySelect.value || "daily";
    const weeklyTarget = getNumberOrNull(weeklyTargetInput?.value || "");
    const weekdays = getSelectedHabitWeekdays();

    if (!name) {
        alert("追加する継続項目名を入力してください。");
        return;
    }

    if (frequency === "weekly_count" && (!weeklyTarget || weeklyTarget < 1 || weeklyTarget > 7)) {
        alert("週◯回の目標回数は1〜7で入力してください。");
        return;
    }

    if (frequency === "weekday" && weekdays.length === 0) {
        alert("曜日指定の場合は、対象曜日を1つ以上選んでください。");
        return;
    }

    const habits = getHabits();
    if (habits.some(h => h.name === name)) {
        alert("同じ継続項目名がすでにあります。");
        return;
    }

    habits.push({
        id: createId("habit"),
        name,
        type,
        frequency,
        weeklyTarget: frequency === "weekly_count" ? weeklyTarget : 0,
        weekdays: frequency === "weekday" ? weekdays : [],
        createdAt: new Date().toISOString()
    });

    setHabits(habits);

    nameInput.value = "";
    if (weeklyTargetInput) weeklyTargetInput.value = "";
    document.querySelectorAll(".habit-weekday-checkbox").forEach(input => input.checked = false);

    renderHabitSettingsList();
    updateAllDisplays();
}

function deleteHabit(habitId) {
    const habit = getHabits().find(h => h.id === habitId);
    if (!habit) return;

    if (!confirm(`継続項目「${habit.name}」を削除しますか？\n過去の達成記録は残ります。`)) return;

    setHabits(getHabits().filter(h => h.id !== habitId));
    renderHabitSettingsList();
    updateAllDisplays();
}

function renderHabitSettingsList() {
    const list = $("habitSettingsList");
    if (!list) return;

    const habits = getHabits();
    list.innerHTML = "";

    if (habits.length === 0) {
        list.innerHTML = `<p class="empty">継続項目はまだありません。必要な項目を追加してください。</p>`;
        return;
    }

    habits.forEach(h => {
        const typeText = h.type === "avoid" ? "回避型：途切れなければ達成" : "実行型：やったら達成";
        const item = document.createElement("div");
        item.className = "habit-setting-item";
        item.innerHTML = `
            <div>
                <span class="habit-setting-name">${escapeHtml(h.name)}</span>
                <span class="habit-setting-detail">${typeText} / ${escapeHtml(getHabitFrequencyText(h))}</span>
            </div>
            <button type="button" class="habit-delete-button" data-habit-delete="${h.id}">削除</button>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll("[data-habit-delete]").forEach(b => b.addEventListener("click", () => deleteHabit(b.dataset.habitDelete)));
}

// ==============================
// 予定テンプレート
// ==============================

function makeScheduleTemplateName(data) {
    const category = data.category || "その他";
    const title = data.title || category;
    const time = data.plannedStart && data.plannedEnd ? ` ${data.plannedStart}-${data.plannedEnd}` : "";
    const place = data.place ? ` ${data.place}` : "";
    return `${category}：${title}${time}${place}`.trim();
}

function normalizeScheduleTemplates(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
        if (!item) return null;
        const title = String(item.title || "").trim();
        const category = String(item.category || "その他").trim();
        if (!title && category !== "休み") return null;
        return {
            id: item.id || createId("schedule_template"),
            name: item.name || makeScheduleTemplateName(item),
            category,
            title: title || category,
            plannedStart: item.plannedStart || "",
            plannedEnd: item.plannedEnd || "",
            place: item.place || "",
            linkedSubject: item.linkedSubject || "",
            linkedSubSubject: item.linkedSubSubject || "",
            memo: item.memo || "",
            usedCount: Number(item.usedCount || 0),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
        };
    }).filter(Boolean);
}

function getScheduleTemplates() {
    const stored = localStorage.getItem(SCHEDULE_TEMPLATES_KEY);
    if (!stored) {
        setScheduleTemplates([]);
        return [];
    }
    return normalizeScheduleTemplates(safeJsonParse(stored, []));
}

function setScheduleTemplates(templates) {
    localStorage.setItem(SCHEDULE_TEMPLATES_KEY, JSON.stringify(normalizeScheduleTemplates(templates)));
}

function getScheduleTemplateFromForm() {
    const schedule = getScheduleFormData();
    return {
        id: createId("schedule_template"),
        name: makeScheduleTemplateName(schedule),
        category: schedule.category || "その他",
        title: schedule.title || schedule.category || "予定",
        plannedStart: schedule.plannedStart || "",
        plannedEnd: schedule.plannedEnd || "",
        place: schedule.place || "",
        linkedSubject: schedule.linkedSubject || "",
        linkedSubSubject: schedule.linkedSubSubject || "",
        memo: schedule.memo || "",
        usedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function saveScheduleAsTemplate() {
    const template = getScheduleTemplateFromForm();

    if (!template.title && template.category !== "休み") {
        alert("テンプレート化する予定名を入力してください。");
        return;
    }

    const templates = getScheduleTemplates();
    const same = templates.find(t =>
        t.category === template.category &&
        t.title === template.title &&
        t.plannedStart === template.plannedStart &&
        t.plannedEnd === template.plannedEnd &&
        t.place === template.place &&
        t.linkedSubject === template.linkedSubject &&
        t.linkedSubSubject === template.linkedSubSubject &&
        t.memo === template.memo
    );

    if (same && !confirm("同じ内容のテンプレートがすでにあります。それでも追加しますか？")) return;

    const customName = prompt("テンプレート名を入力してください。", template.name);
    if (customName === null) return;

    template.name = customName.trim() || template.name;
    templates.push(template);
    setScheduleTemplates(templates);
    renderScheduleTemplateList();
    setText("scheduleStatus", `テンプレート化しました：${template.name}`);
}

function incrementTemplateUse(templateId) {
    const templates = getScheduleTemplates().map(t => {
        if (t.id !== templateId) return t;
        return { ...t, usedCount: Number(t.usedCount || 0) + 1, updatedAt: new Date().toISOString() };
    });
    setScheduleTemplates(templates);
}

function addScheduleTemplateDirectly(templateId) {
    const template = getScheduleTemplates().find(t => t.id === templateId);
    if (!template) return;

    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();

    saveScheduleItem({
        id: "",
        date,
        category: template.category || "その他",
        title: template.title || "",
        plannedStart: template.plannedStart || "",
        plannedEnd: template.plannedEnd || "",
        actualStart: "",
        actualEnd: "",
        place: template.place || "",
        linkedSubject: template.linkedSubject || "",
        linkedSubSubject: template.linkedSubSubject || "",
        memo: template.memo || "",
        updatedAt: new Date().toISOString()
    });

    incrementTemplateUse(templateId);
    setText("scheduleStatus", `追加しました：${date} ${template.name}`);
    updateAllDisplays();
}

function deleteScheduleTemplate(templateId) {
    const target = getScheduleTemplates().find(t => t.id === templateId);
    if (!target) return;
    if (!confirm(`テンプレート「${target.name}」を削除しますか？`)) return;

    setScheduleTemplates(getScheduleTemplates().filter(t => t.id !== templateId));
    renderScheduleTemplateList();
    setText("scheduleStatus", `テンプレートを削除しました：${target.name}`);
}

function renderScheduleTemplateList() {
    const list = $("scheduleTemplateList");
    if (!list) return;

    const filter = $("templateCategoryFilter")?.value || "all";
    const templates = getScheduleTemplates()
        .filter(t => filter === "all" || t.category === filter)
        .sort((a, b) => Number(b.usedCount || 0) - Number(a.usedCount || 0));

    list.innerHTML = "";

    if (templates.length === 0) {
        list.innerHTML = `<p class="empty">${filter === "all" ? "テンプレートはまだありません。" : "このカテゴリのテンプレートはありません。"}</p>`;
        return;
    }

    templates.forEach(t => {
        const timeText = t.plannedStart && t.plannedEnd
            ? `${t.plannedStart}-${formatTimeWithNextDay(t.plannedStart, t.plannedEnd)}`
            : "時刻なし";

        const detail = [
            t.category,
            t.title,
            timeText,
            t.place ? `場所あり` : "",
            t.linkedSubject ? `関連項目あり` : "",
            t.memo ? `メモあり` : "",
            `使用${Number(t.usedCount || 0)}回`
        ].filter(Boolean).join(" / ");

        const item = document.createElement("div");
        item.className = "schedule-template-item compact-template-item";
        item.innerHTML = `
            <span class="schedule-template-title">${escapeHtml(t.name)}</span>
            <span class="schedule-template-meta">${escapeHtml(detail)}</span>
            <div class="schedule-template-actions">
                <button type="button" class="template-add-button" data-template-add="${t.id}">追加</button>
                <button type="button" class="template-delete-button" data-template-delete="${t.id}">削除</button>
            </div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll("[data-template-add]").forEach(b => b.addEventListener("click", () => addScheduleTemplateDirectly(b.dataset.templateAdd)));
    list.querySelectorAll("[data-template-delete]").forEach(b => b.addEventListener("click", () => deleteScheduleTemplate(b.dataset.templateDelete)));
}

// ==============================
// 予定
// ==============================

function getSchedules() {
    const s = safeJsonParse(localStorage.getItem(SCHEDULE_KEY), {});
    if (!s || typeof s !== "object" || Array.isArray(s)) return {};
    return s;
}

function setSchedules(schedules) {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
}

function getSchedulesForDate(date) {
    const schedules = getSchedules();
    return Array.isArray(schedules[date]) ? schedules[date] : [];
}

function saveScheduleItem(schedule) {
    const date = schedule.date;
    if (!date) return;

    const schedules = getSchedules();
    if (!Array.isArray(schedules[date])) schedules[date] = [];

    if (!schedule.id) {
        schedule.id = createId("schedule");
        schedule.createdAt = new Date().toISOString();
        schedules[date].push(schedule);
    } else {
        Object.keys(schedules).forEach(key => {
            schedules[key] = schedules[key].filter(item => item.id !== schedule.id);
            if (schedules[key].length === 0) delete schedules[key];
        });
        if (!Array.isArray(schedules[date])) schedules[date] = [];
        schedules[date].push(schedule);
    }

    schedules[date].sort((a, b) => String(a.plannedStart || "").localeCompare(String(b.plannedStart || "")));
    setSchedules(schedules);
}

function deleteScheduleItem(date, id) {
    const schedules = getSchedules();
    if (!Array.isArray(schedules[date])) return;

    schedules[date] = schedules[date].filter(item => item.id !== id);
    if (schedules[date].length === 0) delete schedules[date];

    setSchedules(schedules);
    updateAllDisplays();
}

function getScheduleFormData() {
    return {
        id: $("editingScheduleId")?.value || "",
        date: $("scheduleDate")?.value || scheduleFocusDate || getTodayString(),
        category: $("scheduleCategory")?.value || "その他",
        title: $("scheduleTitle")?.value.trim() || "",
        plannedStart: $("scheduleStart")?.value || "",
        plannedEnd: $("scheduleEnd")?.value || "",
        actualStart: $("scheduleActualStart")?.value || "",
        actualEnd: $("scheduleActualEnd")?.value || "",
        place: $("schedulePlace")?.value.trim() || "",
        linkedSubject: $("scheduleLinkedSubject")?.value || "",
        linkedSubSubject: $("scheduleLinkedSubSubject")?.value || "",
        memo: $("scheduleMemo")?.value.trim() || "",
        updatedAt: new Date().toISOString()
    };
}

function setScheduleFormData(schedule) {
    if ($("editingScheduleId")) $("editingScheduleId").value = schedule.id || "";
    if ($("scheduleDate")) $("scheduleDate").value = schedule.date || scheduleFocusDate || getTodayString();
    if ($("scheduleCategory")) $("scheduleCategory").value = schedule.category || "その他";
    if ($("scheduleTitle")) $("scheduleTitle").value = schedule.title || "";
    if ($("scheduleStart")) $("scheduleStart").value = schedule.plannedStart || "";
    if ($("scheduleEnd")) $("scheduleEnd").value = schedule.plannedEnd || "";
    if ($("scheduleActualStart")) $("scheduleActualStart").value = schedule.actualStart || "";
    if ($("scheduleActualEnd")) $("scheduleActualEnd").value = schedule.actualEnd || "";
    if ($("schedulePlace")) $("schedulePlace").value = schedule.place || "";
    updateScheduleLinkedSubjectOptions(schedule.linkedSubject || "");
    updateScheduleLinkedSubSubjectOptions(schedule.linkedSubSubject || "");
    if ($("scheduleMemo")) $("scheduleMemo").value = schedule.memo || "";
}

function clearScheduleForm() {
    setScheduleFormData({
        id: "",
        date: scheduleFocusDate || $("recordDate")?.value || getTodayString(),
        category: "勤務",
        title: "",
        plannedStart: "",
        plannedEnd: "",
        actualStart: "",
        actualEnd: "",
        place: "",
        linkedSubject: "",
        linkedSubSubject: "",
        memo: ""
    });
    setText("scheduleStatus", "入力をクリアしました");
}

function saveScheduleFromForm() {
    const s = getScheduleFormData();

    if (!s.date) {
        alert("予定日を入力してください。");
        return;
    }

    if (!s.title && s.category !== "休み") {
        alert("予定名を入力してください。");
        return;
    }

    if (s.category !== "休み" && (!s.plannedStart || !s.plannedEnd)) {
        if (!confirm("開始時刻または終了時刻が空欄です。このまま保存しますか？")) return;
    }

    if (s.category === "休み" && !s.title) s.title = "休み";

    saveScheduleItem(s);
    scheduleFocusDate = s.date;

    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = s.date;

    setText("scheduleStatus", `保存しました：${s.date} ${s.category}`);
    clearScheduleForm();
    updateAllDisplays();
}

function editSchedule(date, id) {
    const target = getSchedulesForDate(date).find(item => item.id === id);
    if (!target) return;

    scheduleFocusDate = date;
    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;
    setScheduleFormData(target);
    setText("scheduleStatus", `予定編集中：${date}`);
    showPage("schedulePage");
}

function duplicateScheduleFromForm() {
    const s = getScheduleFormData();
    if (!s.title && s.category !== "休み") {
        alert("複製する予定がありません。先に予定を編集するか入力してください。");
        return;
    }
    s.id = "";
    s.date = $("scheduleDate")?.value || scheduleFocusDate || getTodayString();
    saveScheduleItem(s);
    setText("scheduleStatus", `複製しました：${s.date} ${s.title || s.category}`);
    updateAllDisplays();
}

function isNightTimeSchedule(schedule) {
    const start = timeToMinutes(schedule.actualStart || schedule.plannedStart);
    const end = timeToMinutes(schedule.actualEnd || schedule.plannedEnd);

    if (start === null || end === null) return false;
    if (end <= start) return true;
    return start >= 21 * 60 || start < 5 * 60 || end > 22 * 60 || end <= 8 * 60;
}

function getScheduleHours(schedule) {
    const start = schedule.actualStart || schedule.plannedStart;
    const end = schedule.actualEnd || schedule.plannedEnd;
    return calculateTimeInBedHours(start, end);
}

function getScheduleClass(schedule) {
    if (schedule.category === "勤務") return "work";
    if (["学習", "講義", "学校", "習い事"].includes(schedule.category)) return "study";
    if (schedule.category === "休み") return "rest";
    return "";
}

function scheduleLineText(schedule) {
    const start = schedule.actualStart || schedule.plannedStart;
    const end = schedule.actualEnd || schedule.plannedEnd;
    const time = start && end ? `${start}-${formatTimeWithNextDay(start, end)}` : "時刻未設定";
    const place = schedule.place ? ` / ${schedule.place}` : "";
    const linked = schedule.linkedSubject ? ` / ${schedule.linkedSubject}${schedule.linkedSubSubject ? "・" + schedule.linkedSubSubject : ""}` : "";
    return `${time}　${schedule.category}：${schedule.title}${place}${linked}`;
}

function inferDayType(date) {
    const schedules = getSchedulesForDate(date);
    if (schedules.some(s => s.category === "勤務" && isNightTimeSchedule(s))) return "夜勤務";
    if (schedules.some(s => s.category === "勤務")) return "勤務日";
    if (schedules.some(s => s.category === "休み")) return "休み";
    if (schedules.some(s => ["学校", "講義", "学習", "習い事"].includes(s.category))) return "学習予定";
    if (schedules.length > 0) return "予定あり";
    return "予定なし";
}

function renderScheduleList(containerId, date) {
    const list = $(containerId);
    if (!list) return;

    const schedules = getSchedulesForDate(date);
    list.innerHTML = "";

    if (schedules.length === 0) {
        list.innerHTML = `<p class="empty">予定はありません。</p>`;
        return;
    }

    schedules.forEach(s => {
        const item = document.createElement("div");
        item.className = `today-schedule-item ${getScheduleClass(s)}`;
        item.innerHTML = `
            <span class="today-schedule-title">${escapeHtml(s.category)}：${escapeHtml(s.title)}</span>
            <span class="today-schedule-meta">${escapeHtml(scheduleLineText(s))}</span>
            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="inline-small-button" data-schedule-edit="${s.id}" data-schedule-date="${date}">編集</button>
                <button type="button" class="inline-small-button" data-schedule-copy="${s.id}" data-schedule-date="${date}">複製</button>
                <button type="button" class="inline-danger-button" data-schedule-delete="${s.id}" data-schedule-date="${date}">削除</button>
            </div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll("[data-schedule-edit]").forEach(b => b.addEventListener("click", () => editSchedule(b.dataset.scheduleDate, b.dataset.scheduleEdit)));
    list.querySelectorAll("[data-schedule-copy]").forEach(b => {
        b.addEventListener("click", () => {
            const source = getSchedulesForDate(b.dataset.scheduleDate).find(x => x.id === b.dataset.scheduleCopy);
            if (!source) return;
            setScheduleFormData({ ...source, id: "", date: scheduleFocusDate || b.dataset.scheduleDate });
            setText("scheduleStatus", "複製用に入力欄へ反映しました。日付を確認して保存してください。");
            showPage("schedulePage");
        });
    });
    list.querySelectorAll("[data-schedule-delete]").forEach(b => {
        b.addEventListener("click", () => {
            if (confirm("この予定を削除しますか？")) deleteScheduleItem(b.dataset.scheduleDate, b.dataset.scheduleDelete);
        });
    });
}

function renderTodayScheduleList() {
    const date = $("recordDate")?.value || getTodayString();
    renderScheduleList("todayScheduleList", date);

    const schedules = getSchedulesForDate(date);
    setText("todayScheduleCount", `${schedules.length}件`);
    setText("autoDayType", inferDayType(date));
}

function renderFocusedScheduleList() {
    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();
    renderScheduleList("focusedScheduleList", date);
}

// ==============================
// タスク
// ==============================

function getTasks() {
    const t = safeJsonParse(localStorage.getItem(TASKS_KEY), {});
    if (!t || typeof t !== "object" || Array.isArray(t)) return {};
    return t;
}

function setTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function normalizeTask(task) {
    return {
        id: task.id || createId("task"),
        date: task.date || getTodayString(),
        category: task.category || "その他",
        title: task.title || "",
        memo: task.memo || "",
        done: task.done === true,
        priority: task.priority || "normal",
        dueDate: task.dueDate || "",
        source: task.source || "",
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString()
    };
}

function getTasksForDate(date) {
    const tasks = getTasks();
    return Array.isArray(tasks[date]) ? tasks[date].map(normalizeTask) : [];
}

function saveTaskItem(task) {
    const normalized = normalizeTask(task);
    const date = normalized.date;
    if (!date) return;

    const tasks = getTasks();
    if (!Array.isArray(tasks[date])) tasks[date] = [];

    if (!task.id) {
        normalized.id = createId("task");
        normalized.createdAt = new Date().toISOString();
        tasks[date].push(normalized);
    } else {
        let oldDone = false;
        Object.keys(tasks).forEach(key => {
            tasks[key] = tasks[key].filter(item => {
                if (item.id === task.id) {
                    oldDone = item.done === true;
                    return false;
                }
                return true;
            });
            if (tasks[key].length === 0) delete tasks[key];
        });
        normalized.done = task.done === true || oldDone;
        if (!Array.isArray(tasks[date])) tasks[date] = [];
        tasks[date].push(normalized);
    }

    setTasks(tasks);
}

function deleteTaskItem(date, id) {
    const tasks = getTasks();
    if (!Array.isArray(tasks[date])) return;

    tasks[date] = tasks[date].filter(item => item.id !== id);
    if (tasks[date].length === 0) delete tasks[date];

    setTasks(tasks);
    updateAllDisplays();
}

function toggleTaskDone(date, id) {
    const tasks = getTasks();
    if (!Array.isArray(tasks[date])) return;

    tasks[date] = tasks[date].map(task => task.id === id ? { ...task, done: !task.done, updatedAt: new Date().toISOString() } : task);
    setTasks(tasks);
    updateAllDisplays();
}

function getTaskFormData() {
    return {
        id: $("editingTaskId")?.value || "",
        date: $("taskDate")?.value || scheduleFocusDate || getTodayString(),
        category: $("taskCategory")?.value || "その他",
        title: $("taskTitle")?.value.trim() || "",
        memo: $("taskMemo")?.value.trim() || "",
        priority: $("taskPriority")?.value || "normal",
        dueDate: $("taskDueDate")?.value || "",
        updatedAt: new Date().toISOString()
    };
}

function setTaskFormData(task) {
    const t = normalizeTask(task);
    if ($("editingTaskId")) $("editingTaskId").value = t.id || "";
    if ($("taskDate")) $("taskDate").value = t.date || scheduleFocusDate || getTodayString();
    if ($("taskCategory")) $("taskCategory").value = t.category || "その他";
    if ($("taskTitle")) $("taskTitle").value = t.title || "";
    if ($("taskMemo")) $("taskMemo").value = t.memo || "";
    if ($("taskPriority")) $("taskPriority").value = t.priority || "normal";
    if ($("taskDueDate")) $("taskDueDate").value = t.dueDate || "";
}

function clearTaskForm() {
    setTaskFormData({ id: "", date: scheduleFocusDate || $("recordDate")?.value || getTodayString(), category: "学習", title: "", memo: "", priority: "normal", dueDate: "" });
    setText("taskStatus", "入力をクリアしました");
}

function saveTaskFromForm() {
    const t = getTaskFormData();
    if (!t.date) {
        alert("タスク日を入力してください。");
        return;
    }
    if (!t.title) {
        alert("タスク名を入力してください。");
        return;
    }

    saveTaskItem(t);
    scheduleFocusDate = t.date;
    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = t.date;

    setText("taskStatus", `保存しました：${t.date} ${t.title}`);
    clearTaskForm();
    updateAllDisplays();
}

function editTask(date, id) {
    const target = getTasksForDate(date).find(item => item.id === id);
    if (!target) return;

    scheduleFocusDate = date;
    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;

    setTaskFormData(target);
    setText("taskStatus", `タスク編集中：${date}`);
    showPage("schedulePage");
}

function duplicateTaskFromForm() {
    const t = getTaskFormData();
    if (!t.title) {
        alert("複製するタスクがありません。先にタスクを編集するか入力してください。");
        return;
    }
    t.id = "";
    t.done = false;
    t.date = $("taskDate")?.value || scheduleFocusDate || getTodayString();
    saveTaskItem(t);
    setText("taskStatus", `複製しました：${t.date} ${t.title}`);
    updateAllDisplays();
}

function rolloverTaskFromForm() {
    const t = getTaskFormData();
    if (!t.title) {
        alert("繰り越すタスクがありません。先にタスクを編集するか入力してください。");
        return;
    }
    t.id = "";
    t.date = addDays(t.date || scheduleFocusDate || getTodayString(), 1);
    t.done = false;
    saveTaskItem(t);
    setText("taskStatus", `翌日に繰り越しました：${t.date} ${t.title}`);
    updateAllDisplays();
}

function getPriorityText(priority) {
    if (priority === "high") return "重要度：高";
    if (priority === "low") return "重要度：低";
    return "重要度：通常";
}

function getDueClass(dueDate) {
    if (!dueDate) return "";
    const today = getTodayString();
    if (dueDate < today) return "overdue";
    if (dueDate === today) return "today";
    return "";
}

function renderTaskItemHtml(task, date) {
    const dueClass = getDueClass(task.dueDate);
    const priorityClass = task.priority === "high" ? "high" : task.priority === "low" ? "low" : "";
    return `
        <div class="today-task-row">
            <input type="checkbox" class="today-task-checkbox" data-task-toggle="${task.id}" data-task-date="${date}" ${task.done ? "checked" : ""}>
            <div>
                <span class="today-task-title">${escapeHtml(task.title)}</span>
                <span class="today-task-meta">${escapeHtml(task.category)}${task.memo ? " / " + escapeHtml(task.memo) : ""}${task.source === "tomorrowAction" ? " / 明日実践" : ""}</span>
                <span class="task-priority-pill ${priorityClass}">${getPriorityText(task.priority)}</span>
                ${task.dueDate ? `<span class="task-due-pill ${dueClass}">期限：${task.dueDate}</span>` : ""}
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="inline-small-button" data-task-edit="${task.id}" data-task-date="${date}">編集</button>
                <button type="button" class="inline-small-button" data-task-copy="${task.id}" data-task-date="${date}">複製</button>
                <button type="button" class="inline-small-button" data-task-rollover="${task.id}" data-task-date="${date}">翌日へ</button>
                <button type="button" class="inline-danger-button" data-task-delete="${task.id}" data-task-date="${date}">削除</button>
            </div>
        </div>
    `;
}

function attachTaskListEvents(list) {
    list.querySelectorAll("[data-task-toggle]").forEach(input => input.addEventListener("change", () => toggleTaskDone(input.dataset.taskDate, input.dataset.taskToggle)));
    list.querySelectorAll("[data-task-edit]").forEach(b => b.addEventListener("click", () => editTask(b.dataset.taskDate, b.dataset.taskEdit)));
    list.querySelectorAll("[data-task-copy]").forEach(b => {
        b.addEventListener("click", () => {
            const source = getTasksForDate(b.dataset.taskDate).find(t => t.id === b.dataset.taskCopy);
            if (!source) return;
            setTaskFormData({ ...source, id: "", done: false, date: scheduleFocusDate || b.dataset.taskDate });
            setText("taskStatus", "複製用に入力欄へ反映しました。日付を確認して保存してください。");
            showPage("schedulePage");
        });
    });
    list.querySelectorAll("[data-task-rollover]").forEach(b => {
        b.addEventListener("click", () => {
            const source = getTasksForDate(b.dataset.taskDate).find(t => t.id === b.dataset.taskRollover);
            if (!source) return;
            const nextDate = addDays(source.date, 1);
            saveTaskItem({ ...source, id: "", done: false, date: nextDate });
            setText("taskStatus", `翌日に繰り越しました：${nextDate} ${source.title}`);
            updateAllDisplays();
        });
    });
    list.querySelectorAll("[data-task-delete]").forEach(b => {
        b.addEventListener("click", () => {
            if (confirm("このタスクを削除しますか？")) deleteTaskItem(b.dataset.taskDate, b.dataset.taskDelete);
        });
    });
}

function renderTaskList(containerId, date) {
    const list = $(containerId);
    if (!list) return;

    const tasks = getTasksForDate(date);
    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = `<p class="empty">タスクはありません。</p>`;
        return;
    }

    tasks.forEach(t => {
        const item = document.createElement("div");
        item.className = `today-task-item ${t.done ? "done" : ""}`;
        item.innerHTML = renderTaskItemHtml(t, date);
        list.appendChild(item);
    });

    attachTaskListEvents(list);
}

function renderTodayTaskList() {
    const date = $("recordDate")?.value || getTodayString();
    renderTaskList("todayTaskList", date);
    renderTaskList("nightTaskList", date);

    const pending = getTasksForDate(date).filter(t => !t.done).length;
    setText("todayPendingTaskCount", `${pending}件`);
}

function renderFocusedTaskList() {
    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();
    renderTaskList("focusedTaskList", date);
}

function getAllTasksFlat() {
    const tasks = getTasks();
    const result = [];

    Object.keys(tasks).forEach(date => {
        if (!Array.isArray(tasks[date])) return;
        tasks[date].forEach(t => result.push(normalizeTask({ ...t, date })));
    });

    return result;
}

function renderPendingTaskList() {
    const list = $("pendingTaskList");
    if (!list) return;

    const priorityScore = { high: 0, normal: 1, low: 2 };
    const pending = getAllTasksFlat()
        .filter(t => !t.done)
        .sort((a, b) => {
            const dueA = a.dueDate || "9999-99-99";
            const dueB = b.dueDate || "9999-99-99";
            if (dueA !== dueB) return dueA.localeCompare(dueB);
            return (priorityScore[a.priority] ?? 1) - (priorityScore[b.priority] ?? 1);
        });

    list.innerHTML = "";

    if (pending.length === 0) {
        list.innerHTML = `<p class="empty">未完了タスクはありません。</p>`;
        return;
    }

    pending.slice(0, 30).forEach(t => {
        const item = document.createElement("div");
        item.className = "pending-task-item";
        item.innerHTML = renderTaskItemHtml(t, t.date);
        list.appendChild(item);
    });

    attachTaskListEvents(list);
}

// ==============================
// 一括入力
// ==============================

function resolveBulkDate(text) {
    const raw = String(text || "").trim();
    const year = Number((scheduleFocusDate || getTodayString()).slice(0, 4));

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const ymd = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (ymd) return `${ymd[1]}-${String(Number(ymd[2])).padStart(2, "0")}-${String(Number(ymd[3])).padStart(2, "0")}`;

    const md = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (md) return `${year}-${String(Number(md[1])).padStart(2, "0")}-${String(Number(md[2])).padStart(2, "0")}`;

    return "";
}

function parseTimeRange(text) {
    const raw = String(text || "").trim();
    const colon = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (colon) return { start: normalizeTime(colon[1]), end: normalizeTime(colon[2]) };

    const hour = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (hour) return { start: normalizeTime(hour[1]), end: normalizeTime(hour[2]) };

    return { start: "", end: "" };
}

function inferBulkScheduleFromLine(line) {
    const parts = line.split(/\s+/);
    const date = resolveBulkDate(parts[0]);
    if (!date) return null;

    const second = parts[1] || "";
    const rest = parts.slice(2).join(" ").trim();

    if (second === "タスク") {
        const category = parts[2] || "その他";
        const title = parts.slice(3).join(" ").trim();
        if (!title) return null;
        return { type: "task", task: { id: "", date, category, title, memo: "", done: false, priority: "normal", dueDate: "", updatedAt: new Date().toISOString() } };
    }

    if (second === "休み") {
        return { type: "schedule", schedule: { id: "", date, category: "休み", title: "休み", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "", place: "", linkedSubject: "", linkedSubSubject: "", memo: line, updatedAt: new Date().toISOString() } };
    }

    const range = parseTimeRange(second);
    if (range.start && range.end) {
        const title = rest || "予定";
        return { type: "schedule", schedule: { id: "", date, category: title.includes("勤務") ? "勤務" : "その他", title, plannedStart: range.start, plannedEnd: range.end, actualStart: "", actualEnd: "", place: "", linkedSubject: "", linkedSubSubject: "", memo: line, updatedAt: new Date().toISOString() } };
    }

    const maybeTime = parts[2] || "";
    const range2 = parseTimeRange(maybeTime);
    if (range2.start && range2.end) {
        const subjectNames = getSubjectNames();
        const foundSubject = subjectNames.find(subject => second.includes(subject) || line.includes(subject));
        const foundSub = foundSubject ? getSubSubjectsFor(foundSubject).find(sub => line.includes(sub)) : "";
        return { type: "schedule", schedule: { id: "", date, category: foundSubject ? "学習" : second || "その他", title: second || "予定", plannedStart: range2.start, plannedEnd: range2.end, actualStart: "", actualEnd: "", place: "", linkedSubject: foundSubject || "", linkedSubSubject: foundSub || "", memo: line, updatedAt: new Date().toISOString() } };
    }

    return { type: "task", task: { id: "", date, category: "その他", title: parts.slice(1).join(" ").trim() || "タスク", memo: "", done: false, priority: "normal", dueDate: "", updatedAt: new Date().toISOString() } };
}

function importBulkScheduleText() {
    const textarea = $("bulkScheduleText");
    if (!textarea) return;

    const lines = textarea.value.split("\n").map(x => x.trim()).filter(Boolean);
    if (lines.length === 0) {
        alert("一括入力テキストを入力してください。");
        return;
    }

    let scheduleCount = 0;
    let taskCount = 0;
    let errorCount = 0;

    lines.forEach(line => {
        const parsed = inferBulkScheduleFromLine(line);
        if (!parsed) {
            errorCount++;
            return;
        }

        if (parsed.type === "schedule") {
            saveScheduleItem(parsed.schedule);
            scheduleCount++;
        } else {
            saveTaskItem(parsed.task);
            taskCount++;
        }
    });

    textarea.value = "";
    setText("bulkImportStatus", `一括登録完了：予定${scheduleCount}件、タスク${taskCount}件、失敗${errorCount}件`);
    updateAllDisplays();
}

// ==============================
// 月間
// ==============================

function updateMonthPlanInputIfEmpty() {
    if ($("monthPlanInput") && !$("monthPlanInput").value) {
        $("monthPlanInput").value = getMonthString($("recordDate")?.value || getTodayString());
    }
}

function renderMonthlyCalendarGrid() {
    const grid = $("monthlyCalendarGrid");
    if (!grid) return;

    updateMonthPlanInputIfEmpty();

    const month = $("monthPlanInput")?.value || getMonthString(getTodayString());
    if (!/^\d{4}-\d{2}$/.test(month)) return;

    const [year, monthNum] = month.split("-").map(Number);
    const first = new Date(year, monthNum - 1, 1);
    const firstWeekday = first.getDay();
    const lastDay = new Date(year, monthNum, 0).getDate();
    const today = getTodayString();
    const selected = scheduleFocusDate || $("scheduleFocusDate")?.value || today;
    const labels = ["日", "月", "火", "水", "木", "金", "土"];

    grid.innerHTML = "";

    labels.forEach(label => {
        const div = document.createElement("div");
        div.className = "monthly-calendar-weekday";
        div.textContent = label;
        grid.appendChild(div);
    });

    for (let i = 0; i < firstWeekday; i++) {
        const empty = document.createElement("div");
        empty.className = "monthly-calendar-day outside";
        grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDay; day++) {
        const date = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const schedules = getSchedulesForDate(date);
        const tasks = getTasksForDate(date);
        const work = schedules.filter(s => s.category === "勤務").length;
        const rest = schedules.filter(s => s.category === "休み").length;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "monthly-calendar-day";
        if (date === today) button.classList.add("today");
        if (date === selected) button.classList.add("selected");

        const badges = [];
        if (schedules.length) badges.push(`<span class="monthly-calendar-badge schedule">予${schedules.length}</span>`);
        if (tasks.length) badges.push(`<span class="monthly-calendar-badge task">タ${tasks.length}</span>`);
        if (work) badges.push(`<span class="monthly-calendar-badge work">勤${work}</span>`);
        if (rest) badges.push(`<span class="monthly-calendar-badge rest">休</span>`);

        button.innerHTML = `
            <span class="monthly-calendar-date">${day}</span>
            <div class="monthly-calendar-badges">${badges.join("")}</div>
        `;

        button.addEventListener("click", () => {
            scheduleFocusDate = date;
            if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;
            if ($("scheduleDate")) $("scheduleDate").value = date;
            if ($("taskDate")) $("taskDate").value = date;
            renderFocusedScheduleList();
            renderFocusedTaskList();
            renderMonthlyCalendarGrid();
        });

        grid.appendChild(button);
    }
}

function renderMonthlyPlanList() {
    const list = $("monthlyPlanList");
    if (!list) return;

    updateMonthPlanInputIfEmpty();

    const month = $("monthPlanInput")?.value || getMonthString(getTodayString());
    const dates = getDatesInMonth(month);
    const schedules = getSchedules();
    const tasks = getTasks();

    let scheduleCount = 0;
    let taskCount = 0;
    let taskDone = 0;

    list.innerHTML = "";

    dates.forEach(date => {
        const daySchedules = Array.isArray(schedules[date]) ? schedules[date] : [];
        const dayTasks = Array.isArray(tasks[date]) ? tasks[date].map(normalizeTask) : [];

        if (daySchedules.length === 0 && dayTasks.length === 0) return;

        scheduleCount += daySchedules.length;
        taskCount += dayTasks.length;
        taskDone += dayTasks.filter(t => t.done).length;

        const lines = [];
        daySchedules.forEach(s => lines.push(`<div class="month-plan-line schedule">${escapeHtml(scheduleLineText(s))}</div>`));
        dayTasks.forEach(t => lines.push(`<div class="month-plan-line task ${t.done ? "done" : ""}">☑ ${escapeHtml(t.category)}：${escapeHtml(t.title)}</div>`));

        const item = document.createElement("div");
        item.className = "month-day-item";
        item.innerHTML = `
            <div class="month-day-header">${date}（${formatShortDate(date)}）</div>
            <div class="month-day-content">${lines.join("")}</div>
        `;
        list.appendChild(item);
    });

    if (list.children.length === 0) list.innerHTML = `<p class="empty">この月の予定・タスクはありません。</p>`;

    setText("monthScheduleCount", `${scheduleCount}件`);
    setText("monthTaskCount", `${taskCount}件`);
    setText("monthTaskDoneRate", taskCount === 0 ? "未計算" : `${Math.round(taskDone / taskCount * 100)}%`);

    renderMonthlyCalendarGrid();
}

// ==============================
// 日次記録
// ==============================

function syncStudySplitToTotal() {
    const h = getNumberOrNull($("studyHoursInput")?.value || "");
    const m = getNumberOrNull($("studyMinutesInput")?.value || "");

    const hours = h === null ? 0 : h;
    const minutes = m === null ? 0 : m;

    if ($("studyTotal")) $("studyTotal").value = String(hours * 60 + minutes);
}

function syncStudyTotalToSplit(total) {
    const n = getNumberOrNull(total);
    const minutes = n === null ? 0 : Math.max(0, Math.round(n));

    if ($("studyHoursInput")) $("studyHoursInput").value = minutes > 0 ? String(Math.floor(minutes / 60)) : "";
    if ($("studyMinutesInput")) $("studyMinutesInput").value = minutes > 0 ? String(minutes % 60) : "";
    if ($("studyTotal")) $("studyTotal").value = total || "";
}

function getFormData() {
    syncStudySplitToTotal();

    const data = {};
    fieldIds.forEach(id => {
        const el = $(id);
        if (el) data[id] = el.value;
    });

    if (!data.workType) data.workType = inferDayType($("recordDate")?.value || getTodayString());
    return data;
}

function setFormData(data) {
    updateSubjectSelectOptions(data.mainSubject || "");
    updateSubSubjectSelectOptions(data.subSubject || "");

    fieldIds.forEach(id => {
        const el = $(id);
        if (el) el.value = data[id] ?? "";
    });

    syncStudyTotalToSplit(data.studyTotal || "");

    const settings = getSettings();
    if (!data.plannedBedtime && $("plannedBedtime")) $("plannedBedtime").value = settings.defaultPlannedBedtime;
    if (!data.plannedWakeTime && $("plannedWakeTime")) $("plannedWakeTime").value = settings.defaultPlannedWakeTime;

    updateRatingDisplays();
    updateSelfScoreDisplay();
    updateCalculatedDisplays();
}

function clearForm() {
    fieldIds.forEach(id => {
        const el = $(id);
        if (el) el.value = "";
    });

    if ($("studyHoursInput")) $("studyHoursInput").value = "";
    if ($("studyMinutesInput")) $("studyMinutesInput").value = "";

    updateSubSubjectSelectOptions("");
    updateRatingDisplays();
    updateSelfScoreDisplay();
    updateCalculatedDisplays();
}

function applyDefaultPlanToForm() {
    const s = getSettings();
    if ($("plannedBedtime")) $("plannedBedtime").value = s.defaultPlannedBedtime;
    if ($("plannedWakeTime")) $("plannedWakeTime").value = s.defaultPlannedWakeTime;
}

function saveCurrentRecord() {
    const date = $("recordDate")?.value;
    if (!date) return;

    const records = getRecords();
    records[date] = getFormData();

    setRecords(records);
    localStorage.setItem(LAST_DATE_KEY, date);

    currentDate = date;
    updateCalculatedDisplays();

    const warnings = validateCurrentRecord();
    updateSaveStatus(
        warnings.length ? `保存しました：${date} ${getCurrentTimeString()}　※確認あり` : `保存しました：${date} ${getCurrentTimeString()}`,
        warnings.length > 0
    );

    updateAllDisplays();
}

function loadRecord(date) {
    const records = getRecords();
    clearForm();

    if (records[date]) {
        setFormData(records[date]);
        updateSaveStatus(`読み込みました：${date}`, false);
    } else {
        applyDefaultPlanToForm();
        updateRatingDisplays();
        updateSelfScoreDisplay();
        updateCalculatedDisplays();
        updateSaveStatus(`新しい記録です：${date}`, false);
    }

    if ($("scheduleDate")) $("scheduleDate").value = date;
    if ($("taskDate")) $("taskDate").value = date;
    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;

    scheduleFocusDate = date;
    currentDate = date;
    localStorage.setItem(LAST_DATE_KEY, date);

    updateAllDisplays();
}

function updateSaveStatus(message, hasWarning) {
    const status = $("saveStatus");
    const card = document.querySelector(".status-card");
    if (status) status.textContent = message;
    if (card) card.classList.toggle("warning", Boolean(hasWarning));
}

// ==============================
// 自己採点
// ==============================

function getSelfScoreValues(days) {
    const records = getRecords();
    return getRecentDates(days).map(date => getNumberOrNull(records[date]?.selfScore)).filter(v => v !== null);
}

function getSelfScoreAverage(days, minCount) {
    const values = getSelfScoreValues(days);
    if (values.length < minCount) return null;
    return averageNumber(values);
}

function shouldShowLowScoreBox(score, date) {
    if (score === null) return { show: false, reason: "未入力" };

    const avg7 = getSelfScoreAverage(7, 3);
    const avg30 = getSelfScoreAverage(30, 10);

    const absoluteLow = score <= 40;
    const relative7 = avg7 !== null && score <= avg7 - 30;
    const relative30 = avg30 !== null && score <= avg30 - 30;

    if (absoluteLow && (relative7 || relative30)) return { show: true, reason: "今日はかなり低い点数です。主な原因を1つだけ選ぶなら？" };
    if (absoluteLow) return { show: true, reason: "今日の自己採点は低めです。主な原因を1つだけ選ぶなら？" };
    if (relative7 || relative30) return { show: true, reason: "今日は普段より大きく低い点数です。主な原因を1つだけ選ぶなら？" };

    return { show: false, reason: "通常範囲です。原因選択は不要です。" };
}

function updateSelfScoreDisplay() {
    const scoreInput = $("selfScore");
    const display = $("selfScoreDisplay");
    const judge = $("selfScoreJudge");
    const lowBox = $("lowScoreBox");
    const score = getNumberOrNull(scoreInput?.value || "");

    if (display) display.textContent = score === null ? "未入力" : `${score}点`;

    const date = $("recordDate")?.value || getTodayString();
    const result = shouldShowLowScoreBox(score, date);

    if (judge) {
        judge.textContent = score === null ? "点数を動かすと、必要に応じて原因選択欄が表示されます。" : result.reason;
    }

    if (lowBox) lowBox.classList.toggle("hidden", !result.show);

    document.querySelectorAll(".reason-button").forEach(button => {
        button.classList.toggle("active", button.dataset.reason === ($("lowScoreReason")?.value || ""));
    });
}

function addTomorrowActionToTask() {
    const action = $("tomorrowAction")?.value.trim() || "";
    const date = $("recordDate")?.value || getTodayString();

    if (!action) {
        alert("明日実践してみることを入力してください。");
        return;
    }

    const tomorrow = addDays(date, 1);

    saveTaskItem({
        id: "",
        date: tomorrow,
        category: "その他",
        title: action,
        memo: "夜の締めから追加",
        done: false,
        priority: "normal",
        dueDate: tomorrow,
        source: "tomorrowAction",
        updatedAt: new Date().toISOString()
    });

    if ($("tomorrowActionAdded")) $("tomorrowActionAdded").value = "true";
    setText("tomorrowActionStatus", `明日のタスクに追加しました：${tomorrow}`);
    saveCurrentRecord();
    updateAllDisplays();
}

function skipTomorrowActionTask() {
    if ($("tomorrowActionAdded")) $("tomorrowActionAdded").value = "false";
    setText("tomorrowActionStatus", "明日のタスクには追加しません。");
    saveCurrentRecord();
}

// ==============================
// チェック・助言
// ==============================

function checkRange(valueText, label, min, max) {
    const warnings = [];
    if (valueText === "") return warnings;

    const value = Number(valueText);
    if (Number.isNaN(value)) warnings.push(`${label}は数値で入力してください`);
    else if (value < min || value > max) warnings.push(`${label}は${min}〜${max}で入力してください`);

    return warnings;
}

function validateCurrentRecord() {
    const warnings = [];
    const r = getFormData();

    const actualTimeInBed = calculateTimeInBedHours(r.bedtime, r.wakeTime);
    const plannedTimeInBed = calculateTimeInBedHours(r.plannedBedtime, r.plannedWakeTime);
    const sleepHours = getNumberOrNull(r.sleepHours);
    const studyTotal = getNumberOrNull(r.studyTotal);
    const napMinutes = getNumberOrNull(r.napMinutes);
    const selfScore = getNumberOrNull(r.selfScore);

    if (plannedTimeInBed !== null && plannedTimeInBed > 14) warnings.push("予定在床時間が14時間を超えています。予定時刻を確認してください");
    if (actualTimeInBed !== null && actualTimeInBed > 16) warnings.push("実際在床時間が16時間を超えています。就寝・起床時刻を確認してください");

    if (r.sleepHours !== "") {
        if (sleepHours === null) warnings.push("実睡眠時間は数値で入力してください");
        else {
            if (sleepHours < 0) warnings.push("実睡眠時間は0以上で入力してください");
            if (sleepHours > 16) warnings.push("実睡眠時間が16時間を超えています。入力値を確認してください");
            if (actualTimeInBed !== null && sleepHours > actualTimeInBed) warnings.push("実睡眠時間が実際在床時間を超えています。入力値を確認してください");
        }
    }

    if (napMinutes !== null && napMinutes > 360) warnings.push("昼寝・仮眠が6時間を超えています。入力値を確認してください");

    warnings.push(...checkRange(r.mood, "起床後の気分", 1, 10));
    warnings.push(...checkRange(r.sleepiness, "起床後の眠気", 1, 10));
    warnings.push(...checkRange(r.fatigue, "起床後の疲労", 1, 10));
    warnings.push(...checkRange(r.focus, "集中できそう感", 1, 10));

    if (r.studyTotal !== "") {
        if (studyTotal === null) warnings.push("取り組み時間は数値で入力してください");
        else if (studyTotal < 0) warnings.push("取り組み時間は0分以上で入力してください");
        else if (studyTotal > 1440) warnings.push("取り組み時間が24時間を超えています。入力値を確認してください");
    }

    if (selfScore !== null && (selfScore < 0 || selfScore > 100)) warnings.push("自己採点は0〜100点で入力してください");

    return warnings;
}

function updateWarnings() {
    const list = $("warningList");
    const card = $("warningCard");
    if (!list) return;

    const warnings = validateCurrentRecord();
    list.innerHTML = "";

    if (warnings.length === 0) {
        list.innerHTML = `<li class="empty">問題は見つかっていません</li>`;
        if (card) card.classList.add("ok");
        return;
    }

    if (card) card.classList.remove("ok");
    warnings.forEach(message => {
        const li = document.createElement("li");
        li.textContent = message;
        list.appendChild(li);
    });
}

function addAdviceItem(list, text, className) {
    const li = document.createElement("li");
    li.textContent = text;
    if (className) li.classList.add(className);
    list.appendChild(li);
}

function updateTodayAdvice() {
    const main = $("todayAdviceMain");
    const list = $("todayAdviceList");
    if (!main || !list) return;

    const date = $("recordDate")?.value || getTodayString();
    const r = getFormData();
    const schedules = getSchedulesForDate(date);
    const tasks = getTasksForDate(date);

    const sleep = getNumberOrNull(r.sleepHours);
    const sleepiness = getNumberOrNull(r.sleepiness);
    const fatigue = getNumberOrNull(r.fatigue);
    const focus = getNumberOrNull(r.focus);
    const study = getNumberOrNull(r.studyTotal);
    const nap = getNumberOrNull(r.napMinutes);

    const pendingTasks = tasks.filter(t => !t.done);
    const workSchedules = schedules.filter(s => s.category === "勤務");

    let mainText = "睡眠・体調・予定・タスクを入力すると、今日の方針を表示します。";
    const items = [];

    if (workSchedules.length > 0) {
        const hasNight = workSchedules.some(isNightTimeSchedule);
        items.push({
            text: hasNight ? "今日は夜勤務系の予定があります。勤務前後の睡眠確保を優先してください。" : "今日は勤務予定があります。予定を詰めすぎないでください。",
            className: "priority-middle"
        });
    }

    if (schedules.length >= 3) {
        items.push({ text: "今日の予定が多めです。タスクは重要な1〜2件に絞ってください。", className: "priority-middle" });
    }

    if (pendingTasks.length >= 4) {
        items.push({ text: `未完了タスクが${pendingTasks.length}件あります。全部終わらせる前提にしないでください。`, className: "priority-middle" });
    }

    if (sleep !== null && sleep < 5) {
        mainText = "今日は回復優先です。重い予定・タスク・取り組みを増やさないでください。";
        items.push({ text: "実睡眠が5時間未満です。回復時間を先に確保してください。", className: "priority-high" });
    } else if (sleep !== null && sleep < 6) {
        mainText = "睡眠がやや不足しています。最低限の継続を優先してください。";
        items.push({ text: "実睡眠が6時間未満です。取り組みは5〜15分単位にしてください。", className: "priority-middle" });
    }

    if (fatigue !== null && fatigue >= 8) {
        mainText = "疲労が強い日です。予定を増やさず、タスクは最低限にしてください。";
        items.push({ text: "疲労が8以上です。未完了タスクを全部処理しようとしないでください。", className: "priority-high" });
    }

    if (sleepiness !== null && sleepiness >= 8) {
        items.push({ text: "眠気が強いです。仮眠・食事・入浴・室温調整のどれかを入れてください。", className: "priority-high" });
    }

    if (focus !== null && focus >= 8) {
        const goal = getGoal();
        const target = goal.priorityItem || r.mainSubject || "重要項目";
        items.push({ text: `集中できそう感が高めです。「${target}」を進める好機です。`, className: "priority-good" });
    }

    if (study !== null && study >= 180) {
        items.push({ text: `取り組み時間は${formatMinutesAsHourMinute(study)}です。追加より睡眠予定を守る方を優先してください。`, className: "priority-good" });
    }

    if (nap !== null && nap >= 90) {
        items.push({ text: `昼寝・仮眠が${nap}分です。夜の寝つきや就寝予定との関係を確認してください。`, className: "priority-middle" });
    }

    const habitCount = getHabitAchievementCount(date);
    if (habitCount > 0) {
        items.push({ text: `今日は継続項目を${habitCount}件達成しています。小さい習慣は維持できています。`, className: "priority-good" });
    }

    if (items.length === 0) {
        items.push({ text: "予定・タスク・睡眠・体調のいずれかを入力すると、方針が具体化します。", className: "priority-middle" });
    }

    main.textContent = mainText;
    list.innerHTML = "";
    items.slice(0, 6).forEach(item => addAdviceItem(list, item.text, item.className));
}

function updateCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
    updateTodayAdvice();
    updateSelfScoreDisplay();
    updateNightTimingMessage();
}

function completeMorningCheck() {
    const date = $("recordDate")?.value || getTodayString();
    if ($("morningCheckedAt")) $("morningCheckedAt").value = new Date().toISOString();
    saveCurrentRecord();
    setText("morningStatus", `完了：${date} ${getCurrentTimeString()}`);
}

function completeNightCheck() {
    const date = $("recordDate")?.value || getTodayString();
    if ($("nightCheckedAt")) $("nightCheckedAt").value = new Date().toISOString();
    saveCurrentRecord();
    setText("nightStatus", `完了：${date} ${getCurrentTimeString()}。この後はスマホを閉じる前提です。`);
}

// ==============================
// 統計・分析
// ==============================

function buildPeriodStats(records, dates) {
    const sleepValues = [];
    const efficiencyValues = [];
    const focusValues = [];
    const fatigueValues = [];
    const sleepinessValues = [];
    const napValues = [];
    const selfScoreValues = [];
    const bedtimeGaps = [];
    const wakeTimeGaps = [];

    let recordDays = 0;
    let sleepShortDays = 0;
    let studyTotal = 0;
    let studyDays = 0;
    let achievementTargetCount = 0;
    let achievedCount = 0;
    const subjectStudyTotals = {};

    dates.forEach(date => {
        const r = records[date];
        if (!r) return;

        recordDays++;

        const sleep = getNumberOrNull(r.sleepHours);
        const eff = calculateSleepEfficiencyFromRecord(r);
        const focus = getNumberOrNull(r.focus);
        const fatigue = getNumberOrNull(r.fatigue);
        const sleepiness = getNumberOrNull(r.sleepiness);
        const nap = getNumberOrNull(r.napMinutes);
        const score = getNumberOrNull(r.selfScore);
        const study = getNumberOrNull(r.studyTotal);
        const ach = calculateAchievementFromRecord(r);

        if (sleep !== null) {
            sleepValues.push(sleep);
            if (sleep < 6) sleepShortDays++;
        }
        if (eff !== null && eff <= 100) efficiencyValues.push(eff);
        if (focus !== null) focusValues.push(focus);
        if (fatigue !== null) fatigueValues.push(fatigue);
        if (sleepiness !== null) sleepinessValues.push(sleepiness);
        if (nap !== null) napValues.push(nap);
        if (score !== null) selfScoreValues.push(score);

        if (study !== null) {
            studyTotal += study;
            if (study > 0) {
                studyDays++;
                const key = `${r.mainSubject || "未選択"}${r.subSubject ? " / " + r.subSubject : ""}`;
                subjectStudyTotals[key] = (subjectStudyTotals[key] || 0) + study;
            }
        }

        if (ach) {
            if (ach.bedtimeGap !== null) bedtimeGaps.push(ach.bedtimeGap);
            if (ach.wakeTimeGap !== null) wakeTimeGaps.push(ach.wakeTimeGap);
            if (ach.canJudgeAchievement) {
                achievementTargetCount++;
                if (ach.achieved) achievedCount++;
            }
        }
    });

    return {
        targetDays: dates.length,
        recordDays,
        sleepValues,
        efficiencyValues,
        focusValues,
        fatigueValues,
        sleepinessValues,
        napValues,
        selfScoreValues,
        bedtimeGaps,
        wakeTimeGaps,
        sleepShortDays,
        studyTotal,
        studyDays,
        achievementTargetCount,
        achievedCount,
        achievementRate: achievementTargetCount === 0 ? null : achievedCount / achievementTargetCount * 100,
        subjectStudyTotals
    };
}

function buildPlanStats(dates) {
    const schedules = getSchedules();
    const tasks = getTasks();

    let scheduleHours = 0;
    let workHours = 0;
    let taskTotal = 0;
    let taskDone = 0;
    let nightScheduleCount = 0;

    dates.forEach(date => {
        const daySchedules = Array.isArray(schedules[date]) ? schedules[date] : [];
        const dayTasks = Array.isArray(tasks[date]) ? tasks[date] : [];

        daySchedules.forEach(s => {
            if (s.category !== "休み") {
                const h = getScheduleHours(s);
                if (h !== null) {
                    scheduleHours += h;
                    if (s.category === "勤務") workHours += h;
                }
            }
            if (s.category === "勤務" && isNightTimeSchedule(s)) nightScheduleCount++;
        });

        dayTasks.forEach(t => {
            taskTotal++;
            if (t.done) taskDone++;
        });
    });

    return {
        scheduleHours,
        workHours,
        taskTotal,
        taskDone,
        taskDoneRate: taskTotal === 0 ? null : taskDone / taskTotal * 100,
        nightScheduleCount
    };
}

function getHabitRateForDates(dates) {
    const habits = getHabits();
    if (habits.length === 0 || dates.length === 0) return null;

    let achieved = 0;
    const total = habits.length * dates.length;

    dates.forEach(date => habits.forEach(h => {
        if (getHabitResult(date, h.id) === true) achieved++;
    }));

    return total === 0 ? null : achieved / total * 100;
}

function updateWeeklySummary() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);

    setText("weeklyAvgSleep", averageText(stats.sleepValues, "時間"));
    setText("weeklyAvgEfficiency", averageText(stats.efficiencyValues, "%"));
    setText("weeklyAvgNap", averageText(stats.napValues, "分"));
    setText("weeklyAvgFocus", averageText(stats.focusValues, ""));
}

function setGapSummary(id, value) {
    const el = $(id);
    if (!el) return;

    el.classList.remove("good", "warning", "danger");
    if (value === null) {
        el.textContent = "未計算";
        return;
    }

    el.textContent = formatGapMinutes(value);
    setSummaryClass(el, value, "gap");
}

function updateAchievementSummary() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);
    const timeInBedGaps = [];

    dates.forEach(date => {
        const ach = calculateAchievementFromRecord(records[date]);
        if (ach && ach.timeInBedGap !== null) timeInBedGaps.push(ach.timeInBedGap);
    });

    setGapSummary("weeklyAvgBedtimeGap", averageNumber(stats.bedtimeGaps));
    setGapSummary("weeklyAvgWakeTimeGap", averageNumber(stats.wakeTimeGaps));
    setGapSummary("weeklyAvgTimeInBedGap", averageNumber(timeInBedGaps));

    const el = $("weeklyAchievementRate");
    if (!el) return;

    el.classList.remove("good", "warning", "danger");
    if (stats.achievementRate === null) el.textContent = "未計算";
    else {
        el.textContent = `${stats.achievementRate.toFixed(0)}%`;
        setSummaryClass(el, stats.achievementRate, "achievement");
    }
}

function buildSubjectStats(days, useSub) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const map = {};
    let totalMinutes = 0;

    dates.forEach(date => {
        const r = records[date];
        if (!r) return;

        const minutes = getNumberOrNull(r.studyTotal);
        if (minutes === null || minutes <= 0) return;

        const parent = r.mainSubject || "未選択";
        const key = useSub ? `${parent} / ${r.subSubject || "子項目未選択"}` : parent;

        totalMinutes += minutes;
        map[key] = (map[key] || 0) + minutes;
    });

    const items = Object.entries(map).map(([subject, minutes]) => ({
        subject,
        minutes,
        percent: totalMinutes > 0 ? minutes / totalMinutes * 100 : 0
    })).sort((a, b) => b.minutes - a.minutes);

    return { days, totalMinutes, items };
}

function renderSubjectAnalysisList(containerId, stats) {
    const container = $(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (stats.items.length === 0) {
        container.innerHTML = `<p class="empty">取り組み時間の記録がありません。</p>`;
        return;
    }

    stats.items.forEach(item => {
        const row = document.createElement("div");
        row.className = "subject-analysis-item";
        row.innerHTML = `
            <div>
                <span class="subject-analysis-name">${escapeHtml(item.subject)}</span>
                <span class="subject-analysis-detail">${stats.days}日中の比率：${item.percent.toFixed(0)}%</span>
            </div>
            <span class="subject-analysis-time">${formatMinutesAsHourMinute(item.minutes)}</span>
        `;
        container.appendChild(row);
    });
}

function updateSubjectAnalysis() {
    const stats7 = buildSubjectStats(7, false);
    const stats30 = buildSubjectStats(30, false);
    const top7 = stats7.items[0];
    const top30 = stats30.items[0];
    const goal = getGoal();

    setText("topSubject7", top7 ? top7.subject : "未計算");
    setText("topSubject30", top30 ? top30.subject : "未計算");

    renderSubjectAnalysisList("subjectAnalysis7", stats7);
    renderSubjectAnalysisList("subjectAnalysis30", stats30);

    const comment = $("subjectAnalysisComment");
    if (!comment) return;

    if (stats7.items.length === 0) comment.textContent = "まだ項目別に分析できる記録がありません。";
    else if (goal.priorityItem && !stats7.items.find(i => i.subject === goal.priorityItem)) comment.textContent = `優先項目「${goal.priorityItem}」が直近7日で未着手です。5〜15分だけでも触れる日を作るとよいです。`;
    else if (top7 && top7.percent >= 70) comment.textContent = `直近7日は「${top7.subject}」に偏っています。意図した偏りか確認してください。`;
    else comment.textContent = "親項目別の取り組みは大きな偏りが少ない状態です。";
}

function updateSubSubjectAnalysis() {
    const stats7 = buildSubjectStats(7, true);
    const stats30 = buildSubjectStats(30, true);
    const top7 = stats7.items[0];
    const top30 = stats30.items[0];

    setText("topSubSubject7", top7 ? top7.subject : "未計算");
    setText("topSubSubject30", top30 ? top30.subject : "未計算");

    renderSubjectAnalysisList("subSubjectAnalysis7", stats7);
    renderSubjectAnalysisList("subSubjectAnalysis30", stats30);

    const comment = $("subSubjectAnalysisComment");
    if (!comment) return;

    if (stats7.items.length === 0) comment.textContent = "まだ子項目・教材別に分析できる記録がありません。";
    else if (top7 && top7.percent >= 70) comment.textContent = `直近7日は「${top7.subject}」に集中しています。他の教材が止まっていないか確認してください。`;
    else comment.textContent = "子項目・教材別の偏りは大きすぎません。";
}

function getWeeklyHabitRate() {
    return getHabitRateForDates(getRecentDates(7));
}

function buildWeeklyCompareText() {
    const records = getRecords();
    const thisDates = getRecentDates(7);
    const lastDates = getRecentDates(14).slice(0, 7);
    const thisWeek = buildPeriodStats(records, thisDates);
    const lastWeek = buildPeriodStats(records, lastDates);

    if (thisWeek.recordDays === 0 && lastWeek.recordDays === 0) return "比較できる記録がまだありません。";
    if (lastWeek.recordDays === 0) return "先週の記録がないため、比較はまだできません。";

    const comments = [];
    const pairs = [
        ["睡眠", averageNumber(thisWeek.sleepValues), averageNumber(lastWeek.sleepValues), "h"],
        ["集中できそう感", averageNumber(thisWeek.focusValues), averageNumber(lastWeek.focusValues), ""],
        ["自己採点", averageNumber(thisWeek.selfScoreValues), averageNumber(lastWeek.selfScoreValues), "点"]
    ];

    pairs.forEach(([label, a, b, unit]) => {
        if (a !== null && b !== null) {
            const diff = a - b;
            comments.push(`${label}：今週${a.toFixed(1)}${unit} / 先週${b.toFixed(1)}${unit}（${diff >= 0 ? "+" : ""}${diff.toFixed(1)}）`);
        }
    });

    if (thisWeek.studyTotal > 0 || lastWeek.studyTotal > 0) {
        const diff = thisWeek.studyTotal - lastWeek.studyTotal;
        comments.push(`取り組み時間：今週${formatMinutesAsHourMinute(thisWeek.studyTotal)} / 先週${formatMinutesAsHourMinute(lastWeek.studyTotal)}（${diff >= 0 ? "+" : ""}${diff}分）`);
    }

    return comments.length ? comments.join("。") : "比較には記録がもう少し必要です。";
}

function buildWeeklyReviewData() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);
    const habitRate = getWeeklyHabitRate();
    const planStats = buildPlanStats(dates);
    const goal = getGoal();

    const good = [];
    const problems = [];
    const nextActions = [];

    const avgSleep = averageNumber(stats.sleepValues);
    const avgFocus = averageNumber(stats.focusValues);
    const avgFatigue = averageNumber(stats.fatigueValues);
    const avgScore = averageNumber(stats.selfScoreValues);

    if (stats.recordDays >= 5) good.push(`7日中${stats.recordDays}日記録できています。`);
    else {
        problems.push(`記録日数が${stats.recordDays}/7日です。`);
        nextActions.push("来週は朝か夜のどちらかだけでも記録してください。");
    }

    if (avgSleep !== null && avgSleep >= 6.5) good.push(`平均実睡眠は${avgSleep.toFixed(1)}時間です。`);
    else if (avgSleep !== null) {
        problems.push(`平均実睡眠は${avgSleep.toFixed(1)}時間で、回復不足寄りです。`);
        nextActions.push("来週は取り組み量より睡眠予定を守ることを優先してください。");
    }

    if (stats.studyDays >= 5) good.push(`取り組み記録が${stats.studyDays}日あります。`);
    else {
        problems.push(`取り組み日数は${stats.studyDays}日です。`);
        nextActions.push("来週は5〜15分の最低ラインを固定してください。");
    }

    if (habitRate !== null && habitRate >= 70) good.push(`継続項目の達成率は${habitRate.toFixed(0)}%です。`);
    else if (habitRate !== null) {
        problems.push(`継続項目の達成率は${habitRate.toFixed(0)}%です。`);
        nextActions.push("来週は最重要の継続項目を1つだけ落とさない方針にしてください。");
    }

    if (avgFocus !== null && avgFocus >= 6) good.push(`平均の集中できそう感は${avgFocus.toFixed(1)}です。`);
    else if (avgFocus !== null) {
        problems.push(`集中できそう感は${avgFocus.toFixed(1)}で低めです。`);
        nextActions.push("来週は新規内容より、復習・整理・短時間着手を増やしてください。");
    }

    if (avgFatigue !== null && avgFatigue >= 7) {
        problems.push(`平均疲労は${avgFatigue.toFixed(1)}で高めです。`);
        nextActions.push("休日や勤務後に回復を先に置く日を作ってください。");
    }

    if (avgScore !== null && avgScore >= 70) good.push(`自己採点平均は${avgScore.toFixed(1)}点です。`);
    else if (avgScore !== null) {
        problems.push(`自己採点平均は${avgScore.toFixed(1)}点で低めです。`);
        nextActions.push("低得点日の原因を1つ選び、翌日の小さい行動に変換してください。");
    }

    if (goal.priorityItem) {
        const priority = buildSubjectStats(7, false).items.find(i => i.subject === goal.priorityItem);
        if (priority && priority.minutes > 0) good.push(`優先項目「${goal.priorityItem}」に${formatMinutesAsHourMinute(priority.minutes)}触れています。`);
        else {
            problems.push(`優先項目「${goal.priorityItem}」に直近7日で触れられていません。`);
            nextActions.push(`来週は「${goal.priorityItem}」を5分だけでも入れてください。`);
        }
    }

    if (planStats.taskTotal > 0 && planStats.taskDoneRate >= 70) good.push(`タスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`);
    else if (planStats.taskTotal > 0) {
        problems.push(`タスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`);
        nextActions.push("来週はタスクを1日1〜3件に絞ってください。");
    }

    if (planStats.scheduleHours >= 50) {
        problems.push(`直近7日の予定時間が${planStats.scheduleHours.toFixed(1)}時間あり、予定過多気味です。`);
        nextActions.push("来週は予定の空白時間を意図的に残してください。");
    }

    if (good.length === 0) good.push("まだ良かった点を判定できるほど記録がありません。");
    if (problems.length === 0) problems.push("大きな崩れは検出されていません。");
    if (nextActions.length === 0) nextActions.push("来週は現在のリズムを維持し、優先項目に少しずつ時間を寄せてください。");

    let conclusion = "今週の記録から、来週の方針を整理します。";
    if (problems.length >= 4) conclusion = "今週は崩れ要因が複数あります。成果拡大より、睡眠・予定圧縮・最低限の継続を優先してください。";
    else if (good.length >= 4 && problems.length <= 1) conclusion = "今週は比較的安定しています。来週は優先項目に少し負荷を足せます。";
    else conclusion = "今週は良い点と崩れた点が混在しています。来週は最低ラインを小さく固定してください。";

    return { conclusion, good, problems, nextActions, recordDays: stats.recordDays, habitRate, studyDays: stats.studyDays, avgScore };
}

function renderWeeklyList(id, items) {
    const list = $(id);
    if (!list) return;
    list.innerHTML = "";
    items.slice(0, 5).forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
    });
}

function updateWeeklyReview() {
    const data = buildWeeklyReviewData();
    setText("weeklyReviewConclusion", data.conclusion);
    setText("weeklyReviewCompare", buildWeeklyCompareText());
    setText("weeklyReviewRecordDays", `${data.recordDays}/7日`);
    setText("weeklyReviewHabitRate", data.habitRate === null ? "未計算" : `${data.habitRate.toFixed(0)}%`);
    setText("weeklyReviewSelfScore", data.avgScore === null ? "未計算" : `${data.avgScore.toFixed(1)}点`);

    renderWeeklyList("weeklyReviewGoodList", data.good);
    renderWeeklyList("weeklyReviewProblemList", data.problems);
    renderWeeklyList("weeklyReviewNextActionList", data.nextActions);
}

function updatePlanAnalysis() {
    const stats = buildPlanStats(getRecentDates(7));

    setText("scheduleHours7", stats.scheduleHours > 0 ? `${stats.scheduleHours.toFixed(1)}h` : "未計算");
    setText("workHours7", stats.workHours > 0 ? `${stats.workHours.toFixed(1)}h` : "未計算");
    setText("taskDoneRate7", stats.taskDoneRate === null ? "未計算" : `${stats.taskDoneRate.toFixed(0)}%`);

    const risk = $("scheduleRiskLevel");
    if (risk) {
        risk.className = "summary-value";
        if (stats.scheduleHours >= 60 || stats.workHours >= 40 || stats.nightScheduleCount >= 3) {
            risk.textContent = "高め";
            risk.classList.add("danger");
        } else if (stats.scheduleHours >= 40 || stats.workHours >= 25 || stats.nightScheduleCount >= 1) {
            risk.textContent = "中程度";
            risk.classList.add("warning");
        } else if (stats.scheduleHours > 0 || stats.taskTotal > 0) {
            risk.textContent = "低め";
            risk.classList.add("good");
        } else {
            risk.textContent = "未計算";
        }
    }

    const comment = $("planAnalysisComment");
    if (!comment) return;

    if (stats.scheduleHours === 0 && stats.taskTotal === 0) comment.textContent = "予定・タスクの記録がまだありません。予定やタスクを入れると、生活負荷を分析できます。";
    else if (stats.workHours >= 40) comment.textContent = `直近7日の勤務時間が${stats.workHours.toFixed(1)}時間です。睡眠・疲労・取り組み時間への影響を確認してください。`;
    else if (stats.scheduleHours >= 50) comment.textContent = `直近7日の予定時間が${stats.scheduleHours.toFixed(1)}時間です。空白時間が不足すると疲労が抜けにくくなります。`;
    else if (stats.taskTotal > 0 && stats.taskDoneRate < 50) comment.textContent = `タスク完了率が${stats.taskDoneRate.toFixed(0)}%です。タスク数を減らし、重要なものだけに絞る方がよいです。`;
    else if (stats.nightScheduleCount >= 1) comment.textContent = `夜勤務系予定が${stats.nightScheduleCount}件あります。勤務前後の睡眠と予定詰め込みに注意してください。`;
    else comment.textContent = "予定・タスクの負荷は過大ではありません。優先項目に時間を配分できているか確認してください。";
}

function getSelfScoreStats(days) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const values = [];
    let lowAbsolute = 0;
    let abnormalLow = 0;
    const reasonCount = {};
    let tomorrowTaskTotal = 0;
    let tomorrowTaskDone = 0;

    dates.forEach(date => {
        const r = records[date];
        if (!r) return;

        const score = getNumberOrNull(r.selfScore);
        if (score !== null) {
            values.push(score);
            if (score <= 40) lowAbsolute++;

            const judged = shouldShowLowScoreBox(score, date);
            if (judged.show && score > 40) abnormalLow++;

            if (r.lowScoreReason && r.lowScoreReason !== "選ばない") {
                reasonCount[r.lowScoreReason] = (reasonCount[r.lowScoreReason] || 0) + 1;
            }
        }
    });

    getAllTasksFlat().forEach(task => {
        if (task.source !== "tomorrowAction") return;
        if (!dates.includes(task.date)) return;
        tomorrowTaskTotal++;
        if (task.done) tomorrowTaskDone++;
    });

    return {
        values,
        avg: averageNumber(values),
        lowAbsolute,
        abnormalLow,
        reasonCount,
        tomorrowTaskTotal,
        tomorrowTaskDone,
        tomorrowTaskDoneRate: tomorrowTaskTotal === 0 ? null : tomorrowTaskDone / tomorrowTaskTotal * 100
    };
}

function updateSelfScoreAnalysis() {
    const s7 = getSelfScoreStats(7);
    const s30 = getSelfScoreStats(30);

    setText("selfScoreAvg7", s7.avg === null ? "未計算" : `${s7.avg.toFixed(1)}点`);
    setText("selfScoreAvg30", s30.avg === null ? "未計算" : `${s30.avg.toFixed(1)}点`);
    setText("lowScoreDays30", s30.values.length === 0 ? "未計算" : `${s30.lowAbsolute + s30.abnormalLow}日`);
    setText("tomorrowActionDoneRate", s30.tomorrowTaskDoneRate === null ? "未計算" : `${s30.tomorrowTaskDoneRate.toFixed(0)}%`);

    const comment = $("selfScoreComment");
    if (comment) {
        if (s30.avg === null) comment.textContent = "自己採点を入力すると、低得点日や原因の傾向を分析できます。";
        else if (s30.avg < 40) comment.textContent = `直近30日の自己採点平均は${s30.avg.toFixed(1)}点です。かなり厳しい自己評価が続いています。原因を人格ではなく、睡眠・予定・疲労・スマホなどの運用問題として切り分けてください。`;
        else if (s30.lowAbsolute + s30.abnormalLow >= 5) comment.textContent = `低得点または平均より大きく低い日が${s30.lowAbsolute + s30.abnormalLow}日あります。原因ランキングを見て、明日の小さい行動に変換してください。`;
        else if (s30.avg >= 75) comment.textContent = `直近30日の自己採点平均は${s30.avg.toFixed(1)}点です。比較的安定しています。高得点日の条件を崩さないことが重要です。`;
        else comment.textContent = `直近30日の自己採点平均は${s30.avg.toFixed(1)}点です。低得点日は原因選択と明日実践タスクで改善ループを作ってください。`;
    }

    const ranking = $("lowScoreReasonRanking");
    if (!ranking) return;

    ranking.innerHTML = "";
    const items = Object.entries(s30.reasonCount).sort((a, b) => b[1] - a[1]);

    if (items.length === 0) {
        ranking.innerHTML = `<p class="empty">まだ理由データがありません。</p>`;
        return;
    }

    items.forEach(([reason, count]) => {
        const item = document.createElement("div");
        item.className = "factor-item";
        item.innerHTML = `
            <div>
                <span class="factor-name">${escapeHtml(reason)}</span>
                <span class="factor-detail">直近30日の低得点理由</span>
            </div>
            <span class="factor-score">${count}回</span>
        `;
        ranking.appendChild(item);
    });
}

function updateHabitAnalysis() {
    const list = $("habitAnalysisList");
    const comment = $("habitAnalysisComment");
    if (!list) return;

    const habits = getHabits();
    const date = $("recordDate")?.value || getTodayString();

    list.innerHTML = "";

    if (habits.length === 0) {
        list.innerHTML = `<p class="empty">継続項目はまだありません。設定ページで追加してください。</p>`;
        if (comment) comment.textContent = "継続項目が追加されると、達成率や継続日数を表示します。";
        return;
    }

    let bestHabit = null;
    let bestStreak = 0;

    habits.forEach(h => {
        const streak = getHabitStreakUntil(date, h.id);
        const rate7 = getHabitAchievementRate(h.id, 7);
        const rate30 = getHabitAchievementRate(h.id, 30);
        const week = getHabitWeeklyProgress(h, date);

        if (streak > bestStreak) {
            bestStreak = streak;
            bestHabit = h;
        }

        const item = document.createElement("div");
        item.className = "habit-analysis-item";
        item.innerHTML = `
            <p class="habit-analysis-title">${escapeHtml(h.name)} <span class="habit-frequency-pill">${escapeHtml(getHabitFrequencyText(h))}</span></p>
            <div class="habit-analysis-grid">
                <div class="habit-metric">
                    <span class="habit-metric-label">現在の継続</span>
                    <span class="habit-metric-value">${streak}日</span>
                </div>
                <div class="habit-metric">
                    <span class="habit-metric-label">直近7日達成率</span>
                    <span class="habit-metric-value">${rate7.rate.toFixed(0)}%</span>
                </div>
                <div class="habit-metric">
                    <span class="habit-metric-label">週進捗</span>
                    <span class="habit-metric-value">${week.achieved}/${week.target}</span>
                </div>
            </div>
            <p class="habit-effect-text">30日達成率：${rate30.rate.toFixed(0)}%。</p>
        `;
        list.appendChild(item);
    });

    if (comment) {
        comment.textContent = bestHabit && bestStreak > 0
            ? `最も続いているのは「${bestHabit.name}」で、現在${bestStreak}日継続中です。`
            : "まだ継続中の項目はありません。まずは1つだけ実行してください。";
    }
}

// ==============================
// 自動検知
// ==============================

function makeAlert(level, title, message, action, priority) {
    return { level, title, message, action, priority };
}

function detectAutoAlerts() {
    const alerts = [];
    const date = $("recordDate")?.value || getTodayString();
    const r = getFormData();
    const planStats = buildPlanStats(getRecentDates(7));

    const sleep = getNumberOrNull(r.sleepHours);
    const fatigue = getNumberOrNull(r.fatigue);
    const sleepiness = getNumberOrNull(r.sleepiness);
    const focus = getNumberOrNull(r.focus);
    const score = getNumberOrNull(r.selfScore);

    if (sleep !== null && sleep < 5) alerts.push(makeAlert("high", "今日の実睡眠が5時間未満です", `今日の実睡眠は${sleep.toFixed(1)}時間です。`, "重い予定・タスク・取り組みを抑え、回復を優先してください。", 100));
    if (fatigue !== null && fatigue >= 8) alerts.push(makeAlert("high", "今日の疲労が強いです", `疲労は${fatigue}/10です。`, "最低限のタスクだけに絞ってください。", 95));
    if (sleepiness !== null && sleepiness >= 8) alerts.push(makeAlert("high", "今日の眠気が強いです", `眠気は${sleepiness}/10です。`, "仮眠・食事・入浴・室温調整のどれかを入れてください。", 94));

    const lowScoreJudge = shouldShowLowScoreBox(score, date);
    if (score !== null && lowScoreJudge.show) {
        alerts.push(makeAlert("medium", "自己採点が低めです", `今日の自己採点は${score}点です。`, "原因を1つだけ選び、明日実践する小さい行動に変換してください。", 82));
    }

    if (planStats.scheduleHours >= 50) alerts.push(makeAlert("medium", "直近7日の予定時間が多めです", `予定時間は${planStats.scheduleHours.toFixed(1)}時間です。`, "空白時間を残し、睡眠を削らない予定にしてください。", 80));
    if (planStats.workHours >= 35) alerts.push(makeAlert("medium", "勤務時間が多めです", `直近7日の勤務時間は${planStats.workHours.toFixed(1)}時間です。`, "勤務前後の回復時間を先に確保してください。", 78));
    if (planStats.taskTotal > 0 && planStats.taskDoneRate < 50) alerts.push(makeAlert("medium", "タスク完了率が低めです", `直近7日のタスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`, "タスクを減らし、重要な1〜3件に絞ってください。", 70));
    if (focus !== null && focus >= 7 && getNumberOrNull(r.studyTotal) === 0) alerts.push(makeAlert("medium", "集中できそうなのに取り組み0分です", "状態は悪くないのに着手できていない可能性があります。", "5〜15分だけでも優先項目に触れてください。", 65));
    if (getHabits().length > 0 && getHabitAchievementCount(date) === 0) alerts.push(makeAlert("medium", "今日は継続項目が未達成です", "小さい習慣がまだ記録されていません。", "1つだけでも記録してください。", 60));

    const stats = buildPeriodStats(getRecords(), getRecentDates(7));
    const avgSleep = averageNumber(stats.sleepValues);
    if (avgSleep !== null && avgSleep >= 6.5 && planStats.taskTotal > 0 && planStats.taskDoneRate >= 70) alerts.push(makeAlert("good", "睡眠とタスク処理が安定しています", "睡眠と行動のバランスは比較的良好です。", "この状態を維持し、優先項目に少し時間を寄せてください。", 25));
    if (stats.studyDays >= 5) alerts.push(makeAlert("good", "取り組みの継続はできています", `直近7日のうち${stats.studyDays}日で取り組み記録があります。`, "項目配分を確認してください。", 20));

    if (alerts.length === 0) alerts.push(makeAlert("good", "大きな警戒サインは見つかっていません", "現時点で強い崩れは検出されていません。", "記録を続けると分析精度が上がります。", 10));

    return alerts.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

function getAutoAlertConclusion(alerts) {
    const high = alerts.filter(a => a.level === "high").length;
    const medium = alerts.filter(a => a.level === "medium").length;

    if (high >= 2) return "今日は回復優先です。予定・タスク・取り組み量を増やさないでください。";
    if (high === 1) return "今日は慎重運用です。最低限の継続と回復を優先してください。";
    if (medium >= 3) return "生活リズムに注意点があります。予定とタスクを詰めすぎない方が安全です。";
    if (medium >= 1) return "軽い注意点があります。睡眠予定とタスク量を確認してください。";
    return "大きな警戒サインはありません。状態が良い時間に優先項目を進める余地があります。";
}

function updateAutoAlerts() {
    const list = $("autoAlertList");
    if (!list) return;

    const alerts = detectAutoAlerts();
    const high = alerts.filter(a => a.level === "high").length;
    const medium = alerts.filter(a => a.level === "medium").length;
    const good = alerts.filter(a => a.level === "good").length;

    const counts = [
        ["alertHighCount", high, "danger"],
        ["alertMediumCount", medium, "warning"],
        ["alertGoodCount", good, "good"]
    ];

    counts.forEach(([id, count, cls]) => {
        const el = $(id);
        if (!el) return;
        el.textContent = `${count}件`;
        el.className = count > 0 ? `summary-value ${cls}` : "summary-value";
    });

    setText("autoAlertConclusion", getAutoAlertConclusion(alerts));

    list.innerHTML = "";
    alerts.forEach(a => {
        const item = document.createElement("div");
        item.className = `alert-item ${a.level}`;
        const levelText = a.level === "high" ? "警戒" : a.level === "medium" ? "注意" : "良好";
        item.innerHTML = `
            <span class="alert-level ${a.level}">${levelText}</span>
            <p class="alert-title">${escapeHtml(a.title)}</p>
            <p class="alert-message">${escapeHtml(a.message)}</p>
            <p class="alert-action">${escapeHtml(a.action)}</p>
        `;
        list.appendChild(item);
    });
}

// ==============================
// 記録・履歴
// ==============================

function getRecordCompleteness(record, date) {
    const hasSchedule = date ? getSchedulesForDate(date).length > 0 : false;
    const hasTask = date ? getTasksForDate(date).length > 0 : false;
    const hasHabit = date ? getHabitAchievementCount(date) > 0 : false;

    if (!record) return hasSchedule || hasTask || hasHabit ? "partial" : "none";

    const checks = [
        Boolean(record.bedtime || record.wakeTime || record.sleepHours),
        Boolean(record.mood || record.sleepiness || record.fatigue || record.focus),
        Boolean(record.studyTotal || record.mainSubject || record.subSubject),
        Boolean(record.napMinutes),
        Boolean(record.selfScore),
        Boolean(record.memo && record.memo.trim() !== ""),
        hasHabit,
        hasSchedule,
        hasTask
    ];

    const count = checks.filter(Boolean).length;
    if (count === 0) return "none";
    if (count >= 2) return "full";
    return "partial";
}

function getCompletenessLabel(completeness) {
    if (completeness === "full") return "十分";
    if (completeness === "partial") return "一部";
    return "なし";
}

function renderRecordCalendar() {
    const calendar = $("recordCalendar");
    if (!calendar) return;

    const records = getRecords();
    const today = getTodayString();
    calendar.innerHTML = "";

    for (let offset = 29; offset >= 0; offset--) {
        const date = addDays(today, -offset);
        const completeness = getRecordCompleteness(records[date], date);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `calendar-day ${completeness}`;
        if (date === today) button.classList.add("today");
        if (date === currentDate) button.classList.add("selected");

        button.innerHTML = `
            <span class="calendar-day-number">${formatShortDate(date)}</span>
            <span class="calendar-day-label">${getCompletenessLabel(completeness)}</span>
        `;

        button.addEventListener("click", () => {
            if ($("recordDate")) $("recordDate").value = date;
            loadRecord(date);
            showPage("morningPage");
        });

        calendar.appendChild(button);
    }
}

function filterDates(dates) {
    if (historyFilter === "all") return dates;
    const limit = Number(historyFilter);
    return dates.filter(date => {
        const diff = getDaysDiff(date);
        return diff >= 0 && diff <= limit - 1;
    });
}

function renderHistory() {
    const list = $("historyList");
    if (!list) return;

    const records = getRecords();
    const allDates = [...new Set([...Object.keys(records), ...Object.keys(getSchedules()), ...Object.keys(getTasks())])].sort().reverse();
    const dates = filterDates(allDates);

    list.innerHTML = "";

    if (dates.length === 0) {
        list.innerHTML = `<p class="empty">この期間の記録はありません</p>`;
        return;
    }

    dates.forEach(date => {
        const r = records[date] || {};
        const schedules = getSchedulesForDate(date);
        const tasks = getTasksForDate(date);
        const completeness = getRecordCompleteness(records[date], date);
        const efficiency = calculateSleepEfficiencyFromRecord(r);
        const score = getNumberOrNull(r.selfScore);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `history-item ${completeness}`;
        if (date === currentDate) button.classList.add("active");

        button.innerHTML = `
            <span class="history-date">${date}　${getCompletenessLabel(completeness)}記録</span>
            <span class="history-detail">実睡眠 ${valueOrDash(r.sleepHours)}h　効率 ${efficiency === null ? "未計算" : efficiency.toFixed(1) + "%"}　昼寝 ${valueOrDash(r.napMinutes)}分</span>
            <span class="history-detail">取り組み ${formatMinutesAsHourMinute(getNumberOrNull(r.studyTotal) || 0)}　項目 ${valueOrDash(r.mainSubject)}${r.subSubject ? " / " + r.subSubject : ""}</span>
            <span class="history-detail">予定${schedules.length}件　タスク${tasks.length}件　習慣達成${getHabitAchievementCount(date)}件　自己採点 ${score === null ? "未入力" : score + "点"}</span>
        `;

        button.addEventListener("click", () => {
            if ($("recordDate")) $("recordDate").value = date;
            loadRecord(date);
            showPage("morningPage");
        });

        list.appendChild(button);
    });
}

// ==============================
// グラフ
// ==============================

function getChartDates() {
    const range = $("chartRange")?.value || "30";
    if (range === "all") return Object.keys(getRecords()).sort();
    return getRecentDates(Number(range));
}

function buildChartLabels(dates) {
    return dates.map(d => dates.length > 40 ? d.slice(5) : formatShortDate(d));
}

function buildSeriesFromRecords(dates, key, transform) {
    const records = getRecords();
    return dates.map(date => {
        const r = records[date];
        if (!r) return null;
        const value = getNumberOrNull(r[key]);
        if (value === null) return null;
        return transform ? transform(value) : value;
    });
}

function buildGapSeries(dates, type) {
    const records = getRecords();
    return dates.map(date => {
        const ach = calculateAchievementFromRecord(records[date]);
        if (!ach) return null;
        return type === "bedtime" ? ach.bedtimeGap : ach.wakeTimeGap;
    });
}

function resizeCanvasForDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width);
    const height = Math.floor(width * 0.4);

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawEmptyChart(canvasId, message) {
    const canvas = $(canvasId);
    if (!canvas) return;

    resizeCanvasForDisplay(canvas);

    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
}

function drawLineChart(config) {
    const canvas = $(config.canvasId);
    if (!canvas) return;

    resizeCanvasForDisplay(canvas);

    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

    const labels = config.labels || [];
    const datasets = config.datasets || [];
    const values = [];

    datasets.forEach(ds => ds.values.forEach(v => {
        if (v !== null && v !== undefined && !Number.isNaN(v)) values.push(v);
    }));

    if (labels.length === 0 || values.length === 0) {
        drawEmptyChart(config.canvasId, "表示できるデータがありません");
        return;
    }

    const padding = { top: 24, right: 16, bottom: 42, left: 44 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    let minValue = config.minValue !== undefined ? config.minValue : Math.min(...values);
    let maxValue = config.maxValue !== undefined ? config.maxValue : Math.max(...values);

    if (config.includeZero) {
        minValue = Math.min(0, minValue);
        maxValue = Math.max(0, maxValue);
    }

    if (minValue === maxValue) {
        minValue -= 1;
        maxValue += 1;
    }

    const range = maxValue - minValue;

    const xForIndex = index => labels.length === 1 ? padding.left + chartWidth / 2 : padding.left + chartWidth * index / (labels.length - 1);
    const yForValue = value => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + chartHeight * i / 4;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        const value = maxValue - range * i / 4;
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(config.valueDecimals ?? 0), padding.left - 6, y + 4);
    }

    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    const labelStep = labels.length <= 8 ? 1 : Math.ceil(labels.length / 6);
    labels.forEach((label, index) => {
        if (index % labelStep !== 0 && index !== labels.length - 1) return;
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, xForIndex(index), padding.top + chartHeight + 18);
    });

    datasets.forEach(ds => {
        const isActive = config.activeKey && ds.key === config.activeKey;
        const isInactive = config.activeKey && ds.key !== config.activeKey;

        ctx.strokeStyle = ds.color;
        ctx.fillStyle = ds.color;
        ctx.lineWidth = isActive ? 4 : isInactive ? 1.5 : 2;
        ctx.globalAlpha = isInactive ? 0.22 : 1;

        let drawing = false;

        ds.values.forEach((value, index) => {
            if (value === null || value === undefined || Number.isNaN(value)) {
                drawing = false;
                return;
            }

            const x = xForIndex(index);
            const y = yForValue(value);

            if (!drawing) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                drawing = true;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        ds.values.forEach((value, index) => {
            if (value === null || value === undefined || Number.isNaN(value)) return;
            ctx.beginPath();
            ctx.arc(xForIndex(index), yForValue(value), isActive ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    });
}

function updateConditionChartButtons() {
    const labels = { mood: "気分", sleepiness: "眠気", fatigue: "疲労", focus: "集中できそう感" };

    document.querySelectorAll(".condition-chart-button").forEach(button => {
        button.classList.toggle("active", button.dataset.conditionKey === activeConditionChartKey);
    });

    setText(
        "conditionChartFocusStatus",
        activeConditionChartKey ? `現在の強調：${labels[activeConditionChartKey] || activeConditionChartKey}` : "現在の強調：なし（全項目表示）"
    );
}

function updateCharts() {
    const dates = getChartDates();

    if (!dates.length) {
        ["sleepChart", "studyChart", "selfScoreChart", "conditionChart", "gapChart"].forEach(id => drawEmptyChart(id, "記録がありません"));
        return;
    }

    const labels = buildChartLabels(dates);

    drawLineChart({
        canvasId: "sleepChart",
        labels,
        minValue: 0,
        maxValue: 12,
        valueDecimals: 1,
        includeZero: true,
        datasets: [
            { key: "sleepHours", color: "#2563eb", values: buildSeriesFromRecords(dates, "sleepHours") }
        ]
    });

    drawLineChart({
        canvasId: "studyChart",
        labels,
        minValue: 0,
        valueDecimals: 1,
        includeZero: true,
        datasets: [
            { key: "studyTotal", color: "#16a34a", values: buildSeriesFromRecords(dates, "studyTotal", v => v / 60) }
        ]
    });

    drawLineChart({
        canvasId: "selfScoreChart",
        labels,
        minValue: 0,
        maxValue: 100,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            { key: "selfScore", color: "#f97316", values: buildSeriesFromRecords(dates, "selfScore") }
        ]
    });

    drawLineChart({
        canvasId: "conditionChart",
        labels,
        minValue: 0,
        maxValue: 10,
        valueDecimals: 0,
        includeZero: true,
        activeKey: activeConditionChartKey,
        datasets: [
            { key: "mood", color: "#db2777", values: buildSeriesFromRecords(dates, "mood") },
            { key: "sleepiness", color: "#f59e0b", values: buildSeriesFromRecords(dates, "sleepiness") },
            { key: "fatigue", color: "#dc2626", values: buildSeriesFromRecords(dates, "fatigue") },
            { key: "focus", color: "#7c3aed", values: buildSeriesFromRecords(dates, "focus") }
        ]
    });

    drawLineChart({
        canvasId: "gapChart",
        labels,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            { key: "bedtimeGap", color: "#0f766e", values: buildGapSeries(dates, "bedtime") },
            { key: "wakeTimeGap", color: "#ea580c", values: buildGapSeries(dates, "wake") }
        ]
    });

    updateConditionChartButtons();
}

// ==============================
// 体調ボタン
// ==============================

function setupRatingButtons() {
    ratingFields.forEach(field => {
        const container = document.querySelector(`.rating-buttons[data-target="${field.id}"]`);
        if (!container) return;

        container.innerHTML = "";

        for (let value = 1; value <= 10; value++) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "rating-button";
            button.textContent = String(value);
            button.dataset.target = field.id;
            button.dataset.value = String(value);

            button.addEventListener("click", () => {
                const input = $(field.id);
                if (!input) return;
                input.value = input.value === String(value) ? "" : String(value);
                updateRatingDisplays();
                saveCurrentRecord();
            });

            container.appendChild(button);
        }
    });

    updateRatingDisplays();
}

function updateRatingDisplays() {
    ratingFields.forEach(field => {
        const input = $(field.id);
        const display = $(`${field.id}Display`);
        const value = input ? input.value : "";

        if (display) display.textContent = value ? `${value} / 10` : "未入力";

        document.querySelectorAll(`.rating-button[data-target="${field.id}"]`).forEach(button => {
            button.classList.toggle("selected", button.dataset.value === value);
        });
    });
}

// ==============================
// AI
// ==============================

function buildGoalText() {
    const g = getGoal();
    return [
        "【現在の目標】",
        `目標：${valueOrDash(g.title)}`,
        `理由：${valueOrDash(g.reason)}`,
        `最優先項目：${valueOrDash(g.priorityItem)}`,
        `1日の最低ライン：${valueOrDash(g.minimumMinutes)}分`,
        `1日の標準ライン：${valueOrDash(g.standardMinutes)}分`
    ].join("\n");
}

function buildCurrentDayText(date, r) {
    const schedules = getSchedulesForDate(date);
    const tasks = getTasksForDate(date);
    const eff = calculateSleepEfficiencyFromRecord(r);
    const ach = calculateAchievementFromRecord(r);

    return [
        "【現在選択中の日付】",
        `日付：${date}`,
        "",
        "【今日の予定】",
        schedules.length ? schedules.map(scheduleLineText).join("\n") : "予定なし",
        "",
        "【今日のタスク】",
        tasks.length ? tasks.map(t => `${t.done ? "済" : "未"}：${t.category} ${t.title}${t.memo ? " / " + t.memo : ""}${t.priority ? " / " + getPriorityText(t.priority) : ""}${t.dueDate ? " / 期限：" + t.dueDate : ""}`).join("\n") : "タスクなし",
        "",
        "【睡眠】",
        `予定就寝：${valueOrDash(r.plannedBedtime)}`,
        `予定起床：${formatTimeWithNextDay(r.plannedBedtime, r.plannedWakeTime)}`,
        `実際就寝：${valueOrDash(r.bedtime)}`,
        `実際起床：${formatTimeWithNextDay(r.bedtime, r.wakeTime)}`,
        `実睡眠時間：${valueOrDash(r.sleepHours)}時間`,
        `昼寝・仮眠：${valueOrDash(r.napMinutes)}分`,
        `睡眠効率：${eff === null ? "未計算" : eff.toFixed(1) + "%"}`,
        `就寝ズレ：${ach ? formatGapMinutes(ach.bedtimeGap) : "未計算"}`,
        `起床ズレ：${ach ? formatGapMinutes(ach.wakeTimeGap) : "未計算"}`,
        "",
        "【起床後の体調】",
        `気分：${valueOrDash(r.mood)} / 10`,
        `眠気：${valueOrDash(r.sleepiness)} / 10`,
        `疲労：${valueOrDash(r.fatigue)} / 10`,
        `集中できそう感：${valueOrDash(r.focus)} / 10`,
        "",
        "【行動・取り組み】",
        `取り組み時間：${formatMinutesAsHourMinute(getNumberOrNull(r.studyTotal) || 0)}`,
        `親項目：${valueOrDash(r.mainSubject)}`,
        `子項目・教材名：${valueOrDash(r.subSubject)}`,
        `自動判定区分：${inferDayType(date)}`,
        "",
        "【自己採点】",
        `自己採点：${valueOrDash(r.selfScore)}点`,
        `低得点理由：${valueOrDash(r.lowScoreReason)}`,
        `明日実践してみること：${valueOrDash(r.tomorrowAction)}`,
        "",
        "【継続項目】",
        getHabits().map(h => {
            const result = getHabitResult(date, h.id);
            const text = result === true ? "達成" : result === false ? "未達成・途切れた" : "未記録";
            return `${h.name}：${text} / ${getHabitFrequencyText(h)}`;
        }).join("\n") || "継続項目なし",
        "",
        "【メモ】",
        valueOrDash(r.memo)
    ].join("\n");
}

function buildPeriodSummaryText(title, dates, stats) {
    const planStats = buildPlanStats(dates);
    return [
        `【${title}】`,
        `対象期間：${dates[0] || "不明"} 〜 ${dates[dates.length - 1] || "不明"}`,
        `記録日数：${stats.recordDays}/${stats.targetDays}日`,
        `平均実睡眠：${averageText(stats.sleepValues, "時間")}`,
        `平均睡眠効率：${averageText(stats.efficiencyValues, "%")}`,
        `平均昼寝・仮眠：${averageText(stats.napValues, "分")}`,
        `平均集中できそう感：${averageText(stats.focusValues, "")}`,
        `平均疲労：${averageText(stats.fatigueValues, "")}`,
        `平均眠気：${averageText(stats.sleepinessValues, "")}`,
        `自己採点平均：${averageText(stats.selfScoreValues, "")}点`,
        `合計取り組み時間：${formatMinutesAsHourMinute(stats.studyTotal)}`,
        `取り組んだ日数：${stats.studyDays}日`,
        `予定時間：${planStats.scheduleHours.toFixed(1)}時間`,
        `勤務時間：${planStats.workHours.toFixed(1)}時間`,
        `夜勤務系予定：${planStats.nightScheduleCount}件`,
        `タスク完了率：${planStats.taskDoneRate === null ? "未計算" : planStats.taskDoneRate.toFixed(0) + "%"}`
    ].join("\n");
}

function buildWeeklyReviewText() {
    const data = buildWeeklyReviewData();
    return [
        "【週間レビュー】",
        `今週の結論：${data.conclusion}`,
        `先週比較：${buildWeeklyCompareText()}`,
        `記録日数：${data.recordDays}/7日`,
        `習慣達成率：${data.habitRate === null ? "未計算" : data.habitRate.toFixed(0) + "%"}`,
        `自己採点平均：${data.avgScore === null ? "未計算" : data.avgScore.toFixed(1) + "点"}`,
        "",
        "良かった点：",
        ...data.good.map(x => `・${x}`),
        "",
        "崩れた点：",
        ...data.problems.map(x => `・${x}`),
        "",
        "来週の方針：",
        ...data.nextActions.map(x => `・${x}`)
    ].join("\n");
}

function buildPlanSummaryText(days) {
    const stats = buildPlanStats(getRecentDates(days));
    return [
        `【直近${days}日の予定・タスク】`,
        `予定時間：${stats.scheduleHours.toFixed(1)}時間`,
        `勤務時間：${stats.workHours.toFixed(1)}時間`,
        `夜勤務系予定：${stats.nightScheduleCount}件`,
        `タスク件数：${stats.taskTotal}件`,
        `タスク完了：${stats.taskDone}件`,
        `タスク完了率：${stats.taskDoneRate === null ? "未計算" : stats.taskDoneRate.toFixed(0) + "%"}`
    ].join("\n");
}

function buildSubjectSummaryText(days) {
    const stats = buildSubjectStats(days, false);
    if (stats.items.length === 0) return `【直近${days}日の項目別取り組み時間】\n取り組み時間の記録がありません。`;
    return [
        `【直近${days}日の項目別取り組み時間】`,
        ...stats.items.map(i => `${i.subject}：${formatMinutesAsHourMinute(i.minutes)}`)
    ].join("\n");
}

function buildAutoAlertsText() {
    const alerts = detectAutoAlerts();
    return [
        "【自動検知】",
        `今日の結論：${getAutoAlertConclusion(alerts)}`,
        ...alerts.map(a => {
            const level = a.level === "high" ? "警戒" : a.level === "medium" ? "注意" : "良好";
            return `・${level}：${a.title}\n  ${a.message}\n  対応：${a.action}`;
        })
    ].join("\n");
}

function buildRecentDailyLines() {
    const records = getRecords();
    const dates = getRecentDates(7);

    return [
        "【直近7日の各日データ】",
        ...dates.map(date => {
            const r = records[date];
            if (!r) return `${date}：日次記録なし、予定${getSchedulesForDate(date).length}件、タスク${getTasksForDate(date).length}件`;

            return `${date}：睡眠${valueOrDash(r.sleepHours)}h、昼寝${valueOrDash(r.napMinutes)}分、気分${valueOrDash(r.mood)}、眠気${valueOrDash(r.sleepiness)}、疲労${valueOrDash(r.fatigue)}、集中できそう感${valueOrDash(r.focus)}、取り組み${formatMinutesAsHourMinute(getNumberOrNull(r.studyTotal) || 0)}、自己採点${valueOrDash(r.selfScore)}点、低得点理由${valueOrDash(r.lowScoreReason)}、予定${getSchedulesForDate(date).length}件、タスク${getTasksForDate(date).length}件、習慣達成${getHabitAchievementCount(date)}件`;
        })
    ].join("\n");
}

function buildAiText(type, date, record) {
    const records = getRecords();
    const common = [
        "以下は、Life Growth Analyzerから出力した生活記録データです。",
        "朝チェック、夜の締め、睡眠、体調、予定、タスク、習慣、自己採点をもとに、現実的に継続できる改善案を出してください。",
        "自己採点が低い場合でも人格否定ではなく、原因と次の行動に分解してください。",
        "",
        buildGoalText(),
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildPeriodSummaryText("直近7日の要約", getRecentDates(7), buildPeriodStats(records, getRecentDates(7))),
        "",
        buildWeeklyReviewText(),
        "",
        buildPlanSummaryText(7),
        "",
        buildSubjectSummaryText(30)
    ];

    if (type === "weekly") {
        return [
            ...common,
            "",
            buildRecentDailyLines(),
            "",
            "【相談したいこと】",
            "1. 今週の良かった点と崩れた点を整理してほしい。",
            "2. 自己採点が低い日を、原因と翌日の行動に分解してほしい。",
            "3. 来週の最低ラインを現実的に設定してほしい。",
            "4. 朝チェックと夜の締めを継続しやすくする案を出してほしい。"
        ].join("\n");
    }

    if (type === "thirty") {
        return [
            ...common,
            "",
            buildPeriodSummaryText("直近30日の要約", getRecentDates(30), buildPeriodStats(records, getRecentDates(30))),
            "",
            buildPlanSummaryText(30),
            "",
            buildRecentDailyLines(),
            "",
            "【相談したいこと】",
            "1. 直近30日の生活リズムの問題点は何か。",
            "2. 睡眠・疲労・予定・タスク・自己採点のどこを優先的に直すべきか。",
            "3. 低得点理由から見える改善ポイントは何か。",
            "4. 現在の目標に対して、予定と取り組み配分は妥当か。"
        ].join("\n");
    }

    if (type === "goal") {
        return [
            ...common,
            "",
            buildPlanSummaryText(30),
            "",
            "【相談したいこと】",
            "1. 現在の目標に対して、1日の最低ラインと標準ラインは妥当か。",
            "2. 睡眠と予定を崩さずに優先項目へ触れる設計を提案してほしい。",
            "3. 自己採点と実績のズレをどう扱うべきか。"
        ].join("\n");
    }

    return [
        ...common,
        "",
        buildRecentDailyLines(),
        "",
        "【相談したいこと】",
        "1. 今日の予定とタスク量は多すぎるか。",
        "2. 今日の取り組み量は増やすべきか、抑えるべきか。",
        "3. 自己採点をどう受け止めて、明日に何を残すべきか。",
        "4. 明日崩れないための具体的な一手は何か。"
    ].join("\n");
}

function getSelectedConsultType() {
    const selected = document.querySelector('input[name="consultType"]:checked');
    return selected ? selected.value : "today";
}

function getConsultTypeLabel(type) {
    if (type === "weekly") return "週間レビュー相談";
    if (type === "thirty") return "直近30日の生活改善相談";
    if (type === "goal") return "目標達成・行動計画相談";
    return "今日の行動相談";
}

function generateAiConsultText() {
    saveCurrentRecord();
    const date = $("recordDate")?.value || getTodayString();
    const record = getRecords()[date] || getFormData();
    const type = getSelectedConsultType();

    if ($("aiConsultText")) $("aiConsultText").value = buildAiText(type, date, record);
    setText("copyStatus", `作成しました：${getConsultTypeLabel(type)}`);
}

function copyAiConsultText() {
    const textarea = $("aiConsultText");
    if (!textarea || !textarea.value) {
        setText("copyStatus", "コピーするテキストがありません。先に作成してください。");
        return;
    }

    textarea.focus();
    textarea.select();

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textarea.value).then(() => {
            setText("copyStatus", "コピーしました。ChatGPTに貼り付けて相談できます。");
        }).catch(() => {
            document.execCommand("copy");
            setText("copyStatus", "コピーしました。");
        });
    } else {
        document.execCommand("copy");
        setText("copyStatus", "コピーしました。");
    }
}

// ==============================
// 設定
// ==============================

function loadSettingsToForm() {
    const s = getSettings();
    if ($("defaultPlannedBedtime")) $("defaultPlannedBedtime").value = s.defaultPlannedBedtime;
    if ($("defaultPlannedWakeTime")) $("defaultPlannedWakeTime").value = s.defaultPlannedWakeTime;
    updateSettingsStatus();
}

function saveSettingsFromForm() {
    const settings = {
        defaultPlannedBedtime: $("defaultPlannedBedtime")?.value || "",
        defaultPlannedWakeTime: $("defaultPlannedWakeTime")?.value || ""
    };

    setSettings(settings);
    updateSettingsStatus();

    if ($("plannedBedtime") && !$("plannedBedtime").value) $("plannedBedtime").value = settings.defaultPlannedBedtime;
    if ($("plannedWakeTime") && !$("plannedWakeTime").value) $("plannedWakeTime").value = settings.defaultPlannedWakeTime;

    saveCurrentRecord();
    alert("基本睡眠予定を保存しました。");
}

function updateSettingsStatus() {
    const s = getSettings();
    if (!$("settingsStatus")) return;

    $("settingsStatus").textContent = s.defaultPlannedBedtime && s.defaultPlannedWakeTime
        ? `設定中：${s.defaultPlannedBedtime} 〜 ${s.defaultPlannedWakeTime}`
        : "未設定";
}

function loadGoalToForm() {
    const g = getGoal();

    if ($("goalTitle")) $("goalTitle").value = g.title;
    if ($("goalReason")) $("goalReason").value = g.reason;
    updateGoalPriorityOptions(g.priorityItem);
    if ($("goalMinimumMinutes")) $("goalMinimumMinutes").value = g.minimumMinutes;
    if ($("goalStandardMinutes")) $("goalStandardMinutes").value = g.standardMinutes;

    updateGoalStatus();
}

function saveGoalFromForm() {
    const goal = {
        title: $("goalTitle")?.value.trim() || "",
        reason: $("goalReason")?.value.trim() || "",
        priorityItem: $("goalPriorityItem")?.value || "",
        minimumMinutes: $("goalMinimumMinutes")?.value || "",
        standardMinutes: $("goalStandardMinutes")?.value || ""
    };

    setGoal(goal);
    updateGoalStatus();
    updateAllDisplays();
    alert("目標設定を保存しました。");
}

function updateGoalStatus() {
    const status = $("goalStatus");
    if (!status) return;

    const g = getGoal();
    if (!g.title) {
        status.textContent = "未設定";
        return;
    }

    const priority = g.priorityItem ? ` / 優先項目：${g.priorityItem}` : "";
    const minimum = g.minimumMinutes ? ` / 最低${g.minimumMinutes}分` : "";
    const standard = g.standardMinutes ? ` / 標準${g.standardMinutes}分` : "";
    status.textContent = `設定中：${g.title}${priority}${minimum}${standard}`;
}

// ==============================
// バックアップ・削除
// ==============================

function buildFullBackupData(versionLabel = "10.0") {
    return {
        appName: "Life Growth Analyzer",
        version: versionLabel,
        exportedAt: new Date().toISOString(),
        settings: getSettings(),
        subjects: getSubjectConfigs(),
        goal: getGoal(),
        habits: getHabits(),
        habitRecords: getHabitRecords(),
        schedules: getSchedules(),
        tasks: getTasks(),
        scheduleTemplates: getScheduleTemplates(),
        records: getRecords(),
        onboarding: getOnboarding()
    };
}

function exportData() {
    const fileName = `life-growth-analyzer-backup-${getTodayString()}.json`;
    downloadJson(buildFullBackupData("10.0"), fileName);
    updateSaveStatus(`バックアップを作成しました：${fileName}`, false);
    setText("backupStatus", `バックアップを作成しました：${fileName}`);
}

function exportTemplatesOnly() {
    const fileName = `life-growth-analyzer-templates-${getTodayString()}.json`;
    downloadJson({
        appName: "Life Growth Analyzer",
        version: "10.0",
        exportType: "templates",
        exportedAt: new Date().toISOString(),
        scheduleTemplates: getScheduleTemplates()
    }, fileName);
    setText("backupStatus", `テンプレートだけバックアップしました：${fileName}`);
}

function exportSettingsOnly() {
    const fileName = `life-growth-analyzer-settings-${getTodayString()}.json`;
    downloadJson({
        appName: "Life Growth Analyzer",
        version: "10.0",
        exportType: "settings",
        exportedAt: new Date().toISOString(),
        settings: getSettings(),
        subjects: getSubjectConfigs(),
        goal: getGoal(),
        habits: getHabits()
    }, fileName);
    setText("backupStatus", `設定だけバックアップしました：${fileName}`);
}

function autoBackupBeforeDanger(operationName) {
    const fileName = `life-growth-analyzer-auto-backup-before-${operationName}-${getTodayString()}.json`;
    downloadJson(buildFullBackupData(`10.0-auto-before-${operationName}`), fileName);
    return fileName;
}

function refreshAfterDataChange(message) {
    loadSettingsToForm();
    loadSubjectsToUI();
    loadGoalToForm();
    renderHabitSettingsList();
    renderScheduleTemplateList();
    updateAllDisplays();
    setText("dataManagementStatus", message);
    setText("backupStatus", message);
    updateSaveStatus(message, false);
}

function clearDataPart(kind) {
    const labels = {
        records: "日次記録",
        schedules: "予定",
        tasks: "タスク",
        subjects: "取り組み項目",
        habits: "継続項目",
        templates: "予定テンプレート",
        onboarding: "案内表示",
        all: "全データ"
    };

    const label = labels[kind] || kind;

    if (!confirm(`${label}を削除またはリセットします。\n削除前に自動バックアップを作成します。\n実行しますか？`)) return;

    const backupFileName = autoBackupBeforeDanger(`clear-${kind}`);

    if (kind === "records") localStorage.removeItem(STORAGE_KEY);
    else if (kind === "schedules") localStorage.removeItem(SCHEDULE_KEY);
    else if (kind === "tasks") localStorage.removeItem(TASKS_KEY);
    else if (kind === "subjects") {
        localStorage.removeItem(SUBJECTS_KEY);
        localStorage.removeItem(OLD_SUBJECTS_KEY);
    } else if (kind === "habits") {
        localStorage.removeItem(HABITS_KEY);
        localStorage.removeItem(HABIT_RECORDS_KEY);
    } else if (kind === "templates") localStorage.removeItem(SCHEDULE_TEMPLATES_KEY);
    else if (kind === "onboarding") localStorage.removeItem(ONBOARDING_KEY);
    else if (kind === "all") {
        [
            STORAGE_KEY,
            LAST_DATE_KEY,
            SETTINGS_KEY,
            SUBJECTS_KEY,
            OLD_SUBJECTS_KEY,
            GOAL_KEY,
            HABITS_KEY,
            HABIT_RECORDS_KEY,
            SCHEDULE_KEY,
            TASKS_KEY,
            SCHEDULE_TEMPLATES_KEY,
            ONBOARDING_KEY
        ].forEach(key => localStorage.removeItem(key));
    }

    if (kind === "all" || kind === "records") {
        const today = getTodayString();
        if ($("recordDate")) $("recordDate").value = today;
        currentDate = today;
        scheduleFocusDate = today;
        clearForm();
        applyDefaultPlanToForm();
    }

    refreshAfterDataChange(`${label}を処理しました。自動バックアップ：${backupFileName}`);
}

function updateDeleteButton() {
    const button = $("deleteRecordButton");
    const date = $("recordDate")?.value;
    if (!button || !date) return;
    button.disabled = !getRecords()[date];
}

function deleteCurrentRecord() {
    const date = $("recordDate")?.value;
    if (!date) return;

    const records = getRecords();
    if (!records[date]) {
        updateSaveStatus(`削除する記録がありません：${date}`, false);
        return;
    }

    if (!confirm(`${date} の日次記録を削除しますか？\n予定・タスク・習慣記録は削除されません。`)) return;

    delete records[date];
    setRecords(records);
    clearForm();
    applyDefaultPlanToForm();

    currentDate = date;
    localStorage.setItem(LAST_DATE_KEY, date);
    updateSaveStatus(`削除しました：${date}`, false);
    updateAllDisplays();
}

function summarizeImportData(imported) {
    const records = imported.records && typeof imported.records === "object" ? imported.records : imported;
    const schedules = imported.schedules && typeof imported.schedules === "object" ? imported.schedules : {};
    const tasks = imported.tasks && typeof imported.tasks === "object" ? imported.tasks : {};

    return {
        version: imported.version || "不明",
        exportType: imported.exportType || "full",
        recordsCount: records && typeof records === "object" && !Array.isArray(records) ? Object.keys(records).length : 0,
        scheduleDateCount: Object.keys(schedules).length,
        taskDateCount: Object.keys(tasks).length,
        templateCount: Array.isArray(imported.scheduleTemplates) ? imported.scheduleTemplates.length : 0,
        subjectCount: Array.isArray(imported.subjects) ? imported.subjects.length : 0,
        habitCount: Array.isArray(imported.habits) ? imported.habits.length : 0,
        hasSettings: Boolean(imported.settings),
        hasGoal: Boolean(imported.goal)
    };
}

function showImportPreview(imported, fileName) {
    const box = $("importPreviewBox");
    if (!box) return;

    const s = summarizeImportData(imported);

    box.innerHTML = `
        <span class="import-preview-title">復元ファイル確認：${escapeHtml(fileName)}</span>
        <ul class="import-preview-list">
            <li>バージョン：${escapeHtml(s.version)}</li>
            <li>種類：${escapeHtml(s.exportType)}</li>
            <li>日次記録：${s.recordsCount}件</li>
            <li>予定がある日：${s.scheduleDateCount}日</li>
            <li>タスクがある日：${s.taskDateCount}日</li>
            <li>予定テンプレート：${s.templateCount}件</li>
            <li>取り組み項目：${s.subjectCount}件</li>
            <li>継続項目：${s.habitCount}件</li>
            <li>基本睡眠予定：${s.hasSettings ? "あり" : "なし"}</li>
            <li>目標設定：${s.hasGoal ? "あり" : "なし"}</li>
        </ul>
        <p class="import-preview-warning">復元すると現在の同種データは上書きされます。実行前に現在データの自動バックアップを作成します。</p>
    `;

    if ($("confirmImportButton")) $("confirmImportButton").disabled = false;
    if ($("cancelImportButton")) $("cancelImportButton").disabled = false;
}

function prepareImportFromFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
                alert("復元できません。JSONの形式が正しくありません。");
                return;
            }

            pendingImportData = imported;
            pendingImportFileName = file.name || "選択ファイル";
            showImportPreview(imported, pendingImportFileName);
            setText("backupStatus", "復元内容を確認してください。");
        } catch (error) {
            console.error(error);
            alert("復元に失敗しました。JSONファイルを確認してください。");
        }
    };
    reader.readAsText(file);
}

function cancelImport() {
    pendingImportData = null;
    pendingImportFileName = "";

    if ($("importPreviewBox")) $("importPreviewBox").innerHTML = `<p class="empty">復元ファイルを選ぶと、内容確認を表示します。</p>`;
    if ($("confirmImportButton")) $("confirmImportButton").disabled = true;
    if ($("cancelImportButton")) $("cancelImportButton").disabled = true;
    if ($("importFile")) $("importFile").value = "";

    setText("backupStatus", "復元をキャンセルしました。");
}

function confirmImportData() {
    if (!pendingImportData) {
        alert("復元するデータが選択されていません。");
        return;
    }

    const imported = pendingImportData;
    const s = summarizeImportData(imported);

    if (!confirm(`復元を実行します。\nファイル：${pendingImportFileName}\n日次記録：${s.recordsCount}件\n予定テンプレート：${s.templateCount}件\n\n現在データの自動バックアップ作成後に復元します。`)) return;

    const backupFileName = autoBackupBeforeDanger("import");

    if (imported.exportType === "templates") {
        setScheduleTemplates(imported.scheduleTemplates || []);
    } else if (imported.exportType === "settings") {
        if (imported.settings) setSettings(imported.settings);
        if (imported.subjects) setSubjectConfigs(imported.subjects);
        if (imported.goal) setGoal(imported.goal);
        if (imported.habits) setHabits(imported.habits);
    } else {
        const records = imported.records && typeof imported.records === "object" ? imported.records : imported;
        if (records && typeof records === "object" && !Array.isArray(records)) setRecords(records);

        if (imported.settings) setSettings(imported.settings);
        if (imported.subjects) setSubjectConfigs(imported.subjects);
        if (imported.goal) setGoal(imported.goal);
        if (imported.habits) setHabits(imported.habits);
        if (imported.habitRecords) setHabitRecords(imported.habitRecords);
        if (imported.schedules) setSchedules(imported.schedules);
        if (imported.tasks) setTasks(imported.tasks);
        if (imported.scheduleTemplates) setScheduleTemplates(imported.scheduleTemplates);
        if (imported.onboarding) setOnboarding(imported.onboarding);
    }

    loadSettingsToForm();
    loadSubjectsToUI();
    loadGoalToForm();
    renderHabitSettingsList();
    renderScheduleTemplateList();

    const dates = Object.keys(getRecords()).sort().reverse();
    const nextDate = dates[0] || getTodayString();

    if ($("recordDate")) $("recordDate").value = nextDate;
    loadRecord(nextDate);
    cancelImport();
    renderOnboarding();

    updateSaveStatus(`復元しました。事前バックアップ：${backupFileName}`, false);
    setText("backupStatus", `復元しました。事前バックアップ：${backupFileName}`);
    alert("復元が完了しました。");
}

// ==============================
// イベント
// ==============================

function setupInputEvents() {
    fieldIds.forEach(id => {
        const el = $(id);
        if (!el) return;

        el.addEventListener("input", () => {
            if (id === "selfScore") updateSelfScoreDisplay();
            updateRatingDisplays();
            saveCurrentRecord();
        });

        el.addEventListener("change", () => {
            if (id === "mainSubject") updateSubSubjectSelectOptions("");
            if (id === "selfScore") updateSelfScoreDisplay();
            updateRatingDisplays();
            saveCurrentRecord();
        });
    });

    ["studyHoursInput", "studyMinutesInput"].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", () => {
            syncStudySplitToTotal();
            saveCurrentRecord();
        });
        el.addEventListener("change", () => {
            let value = getNumberOrNull(el.value);
            if (value === null || value < 0) el.value = "";
            if (id === "studyMinutesInput" && value !== null && value > 59) el.value = "59";
            syncStudySplitToTotal();
            saveCurrentRecord();
        });
    });
}

function setupDateEvent() {
    if ($("recordDate")) {
        $("recordDate").addEventListener("change", () => {
            const date = $("recordDate").value;
            if (date) loadRecord(date);
        });
    }
}

function setupScheduleFocusEvents() {
    if ($("scheduleFocusDate")) {
        $("scheduleFocusDate").addEventListener("change", () => {
            const date = $("scheduleFocusDate").value;
            if (!date) return;

            scheduleFocusDate = date;

            if ($("scheduleDate")) $("scheduleDate").value = date;
            if ($("taskDate")) $("taskDate").value = date;

            renderFocusedScheduleList();
            renderFocusedTaskList();
            renderMonthlyCalendarGrid();
        });
    }

    if ($("moveScheduleFocusTodayButton")) {
        $("moveScheduleFocusTodayButton").addEventListener("click", () => {
            scheduleFocusDate = getTodayString();

            if ($("scheduleFocusDate")) $("scheduleFocusDate").value = scheduleFocusDate;
            if ($("scheduleDate")) $("scheduleDate").value = scheduleFocusDate;
            if ($("taskDate")) $("taskDate").value = scheduleFocusDate;
            if ($("monthPlanInput")) $("monthPlanInput").value = getMonthString(scheduleFocusDate);

            renderFocusedScheduleList();
            renderFocusedTaskList();
            renderMonthlyCalendarGrid();
        });
    }

    if ($("copyScheduleFocusToRecordDateButton")) {
        $("copyScheduleFocusToRecordDateButton").addEventListener("click", () => {
            const date = scheduleFocusDate || $("scheduleFocusDate")?.value || getTodayString();
            if ($("recordDate")) $("recordDate").value = date;
            loadRecord(date);
            showPage("morningPage");
        });
    }
}

function setupScheduleEvents() {
    if ($("saveScheduleButton")) $("saveScheduleButton").addEventListener("click", saveScheduleFromForm);
    if ($("saveScheduleAsTemplateButton")) $("saveScheduleAsTemplateButton").addEventListener("click", saveScheduleAsTemplate);
    if ($("duplicateScheduleButton")) $("duplicateScheduleButton").addEventListener("click", duplicateScheduleFromForm);
    if ($("clearScheduleFormButton")) $("clearScheduleFormButton").addEventListener("click", clearScheduleForm);
    if ($("importBulkScheduleButton")) $("importBulkScheduleButton").addEventListener("click", importBulkScheduleText);

    if ($("scheduleLinkedSubject")) $("scheduleLinkedSubject").addEventListener("change", () => updateScheduleLinkedSubSubjectOptions(""));
    if ($("templateCategoryFilter")) $("templateCategoryFilter").addEventListener("change", renderScheduleTemplateList);
    if ($("monthPlanInput")) $("monthPlanInput").addEventListener("change", renderMonthlyPlanList);
}

function setupTaskEvents() {
    if ($("saveTaskButton")) $("saveTaskButton").addEventListener("click", saveTaskFromForm);
    if ($("duplicateTaskButton")) $("duplicateTaskButton").addEventListener("click", duplicateTaskFromForm);
    if ($("rolloverTaskButton")) $("rolloverTaskButton").addEventListener("click", rolloverTaskFromForm);
    if ($("clearTaskFormButton")) $("clearTaskFormButton").addEventListener("click", clearTaskForm);
}

function setupHabitEvents() {
    const addButton = $("addHabitButton");
    const input = $("newHabitName");

    if (addButton) addButton.addEventListener("click", addHabit);
    if (input) input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            addHabit();
        }
    });

    document.querySelectorAll(".habit-filter-button").forEach(button => {
        button.addEventListener("click", () => {
            habitFilter = button.dataset.habitFilter || "all";
            document.querySelectorAll(".habit-filter-button").forEach(x => x.classList.remove("active"));
            button.classList.add("active");
            renderTodayHabitList();
        });
    });
}

function setupSubjectEvents() {
    const addButton = $("addSubjectButton");
    const input = $("newSubjectName");

    if (addButton) addButton.addEventListener("click", addSubject);
    if (input) input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            addSubject();
        }
    });

    if ($("mainSubject")) $("mainSubject").addEventListener("change", () => updateSubSubjectSelectOptions(""));
}

function setupHistoryFilterEvents() {
    document.querySelectorAll(".filter-button").forEach(button => {
        button.addEventListener("click", () => {
            historyFilter = button.dataset.filter;
            document.querySelectorAll(".filter-button").forEach(x => x.classList.remove("active"));
            button.classList.add("active");
            renderHistory();
        });
    });
}

function setupChartEvents() {
    if ($("chartRange")) $("chartRange").addEventListener("change", updateCharts);

    document.querySelectorAll(".condition-chart-button").forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.conditionKey;
            activeConditionChartKey = activeConditionChartKey === key ? "" : key;
            updateCharts();
        });
    });

    window.addEventListener("resize", updateCharts);
}

function setupBackupEvents() {
    if ($("exportButton")) $("exportButton").addEventListener("click", exportData);
    if ($("exportTemplatesButton")) $("exportTemplatesButton").addEventListener("click", exportTemplatesOnly);
    if ($("exportSettingsButton")) $("exportSettingsButton").addEventListener("click", exportSettingsOnly);
    if ($("confirmImportButton")) $("confirmImportButton").addEventListener("click", confirmImportData);
    if ($("cancelImportButton")) $("cancelImportButton").addEventListener("click", cancelImport);

    if ($("importFile")) $("importFile").addEventListener("change", e => prepareImportFromFile(e.target.files[0]));
}

function setupDataManagementEvents() {
    if ($("clearDailyRecordsButton")) $("clearDailyRecordsButton").addEventListener("click", () => clearDataPart("records"));
    if ($("clearSchedulesButton")) $("clearSchedulesButton").addEventListener("click", () => clearDataPart("schedules"));
    if ($("clearTasksButton")) $("clearTasksButton").addEventListener("click", () => clearDataPart("tasks"));
    if ($("clearSubjectsButton")) $("clearSubjectsButton").addEventListener("click", () => clearDataPart("subjects"));
    if ($("clearHabitsButton")) $("clearHabitsButton").addEventListener("click", () => clearDataPart("habits"));
    if ($("clearTemplatesButton")) $("clearTemplatesButton").addEventListener("click", () => clearDataPart("templates"));
    if ($("resetOnboardingButton")) $("resetOnboardingButton").addEventListener("click", () => clearDataPart("onboarding"));
    if ($("clearAllDataButton")) $("clearAllDataButton").addEventListener("click", () => clearDataPart("all"));
}

function setupAiTextEvents() {
    if ($("generateAiTextButton")) $("generateAiTextButton").addEventListener("click", generateAiConsultText);
    if ($("copyAiTextButton")) $("copyAiTextButton").addEventListener("click", copyAiConsultText);

    document.querySelectorAll('input[name="consultType"]').forEach(input => {
        input.addEventListener("change", () => {
            if ($("aiConsultText")) $("aiConsultText").value = "";
            setText("copyStatus", `相談タイプを変更しました：${getConsultTypeLabel(getSelectedConsultType())}`);
        });
    });
}

function setupSettingsEvents() {
    if ($("saveSettingsButton")) $("saveSettingsButton").addEventListener("click", saveSettingsFromForm);
}

function setupGoalEvents() {
    if ($("saveGoalButton")) $("saveGoalButton").addEventListener("click", saveGoalFromForm);
}

function setupDeleteEvent() {
    if ($("deleteRecordButton")) $("deleteRecordButton").addEventListener("click", deleteCurrentRecord);
}

function setupSelfScoreEvents() {
    if ($("selfScore")) {
        $("selfScore").addEventListener("input", () => {
            updateSelfScoreDisplay();
            saveCurrentRecord();
        });
    }

    document.querySelectorAll(".reason-button").forEach(button => {
        button.addEventListener("click", () => {
            if ($("lowScoreReason")) $("lowScoreReason").value = button.dataset.reason;
            updateSelfScoreDisplay();
            saveCurrentRecord();
        });
    });

    if ($("addTomorrowActionTaskButton")) $("addTomorrowActionTaskButton").addEventListener("click", addTomorrowActionToTask);
    if ($("skipTomorrowActionTaskButton")) $("skipTomorrowActionTaskButton").addEventListener("click", skipTomorrowActionTask);
}

function setupCompleteEvents() {
    if ($("morningCompleteButton")) $("morningCompleteButton").addEventListener("click", completeMorningCheck);
    if ($("nightCompleteButton")) $("nightCompleteButton").addEventListener("click", completeNightCheck);
}

// ==============================
// 全体更新
// ==============================

function updateAllDisplays() {
    updateCalculatedDisplays();
    renderOnboarding();

    renderScheduleTemplateList();
    renderTodayScheduleList();
    renderTodayTaskList();
    renderFocusedScheduleList();
    renderFocusedTaskList();
    renderPendingTaskList();
    renderMonthlyPlanList();

    renderHistory();
    renderRecordCalendar();

    updateWeeklySummary();
    updateAchievementSummary();
    updatePlanAnalysis();
    updateSelfScoreAnalysis();
    updateAutoAlerts();
    updateSubjectAnalysis();
    updateSubSubjectAnalysis();
    renderTodayHabitList();
    updateHabitAnalysis();
    updateWeeklyReview();

    updateCharts();
    updateDeleteButton();
}

// ==============================
// 初期化
// ==============================

window.addEventListener("load", () => {
    const dateElement = $("recordDate");

    if (!dateElement) {
        console.error("recordDate が見つかりません");
        return;
    }

    setupPageTabs();
    setupAnalysisTabs();

    loadSettingsToForm();
    loadSubjectsToUI();
    loadGoalToForm();
    renderHabitSettingsList();
    renderScheduleTemplateList();
    setupRatingButtons();

    const lastDate = localStorage.getItem(LAST_DATE_KEY);
    const startDate = lastDate || getTodayString();

    dateElement.value = startDate;
    currentDate = startDate;
    scheduleFocusDate = startDate;

    if ($("scheduleDate")) $("scheduleDate").value = startDate;
    if ($("taskDate")) $("taskDate").value = startDate;
    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = startDate;
    if ($("monthPlanInput")) $("monthPlanInput").value = getMonthString(startDate);

    loadRecord(startDate);
    clearScheduleForm();
    clearTaskForm();

    setupInputEvents();
    setupDateEvent();
    setupScheduleFocusEvents();
    setupScheduleEvents();
    setupTaskEvents();
    setupDeleteEvent();
    setupBackupEvents();
    setupDataManagementEvents();
    setupHistoryFilterEvents();
    setupSettingsEvents();
    setupSubjectEvents();
    setupHabitEvents();
    setupGoalEvents();
    setupAiTextEvents();
    setupChartEvents();
    setupSelfScoreEvents();
    setupCompleteEvents();

    showAnalysisSection("analysisWeekly");
    showPage("morningPage");
    updateAllDisplays();

    console.log("Life Growth Analyzer v10.0 初期化完了");
});