// Life Growth Analyzer v9.0

console.log("Life Growth Analyzer v9.0 起動");

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

const defaultSubjectConfigs = [];
const defaultHabits = [];
const defaultScheduleTemplates = [];

const fieldIds = [
    "plannedBedtime",
    "plannedWakeTime",
    "bedtime",
    "wakeTime",
    "sleepHours",
    "awakeCount",
    "mood",
    "sleepiness",
    "fatigue",
    "focus",
    "studyTotal",
    "mainSubject",
    "subSubject",
    "workType",
    "memo"
];

const ratingFields = [
    { id: "mood", label: "気分" },
    { id: "sleepiness", label: "眠気" },
    { id: "fatigue", label: "疲労" },
    { id: "focus", label: "集中力" }
];

let currentDate = "";
let scheduleFocusDate = "";
let historyFilter = "7";
let habitFilter = "all";
let activeConditionChartKey = "";
let currentPageId = "todayPage";

// ==============================
// 共通
// ==============================

function $(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    const element = $(id);
    if (element) element.textContent = text;
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
    const today = new Date();

    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getCurrentTimeString() {
    const now = new Date();

    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function dateStringToDate(dateText) {
    const parts = String(dateText || "").split("-").map(Number);

    if (parts.length !== 3) return null;

    const [year, month, day] = parts;

    if (!year || !month || !day) return null;

    return new Date(year, month - 1, day);
}

function dateToString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateText, days) {
    const date = dateStringToDate(dateText);

    if (!date) return dateText;

    date.setDate(date.getDate() + days);

    return dateToString(date);
}

function getRecentDates(days) {
    const today = getTodayString();
    const dates = [];

    for (let offset = days - 1; offset >= 0; offset--) {
        dates.push(addDays(today, -offset));
    }

    return dates;
}

function getDaysDiff(dateText) {
    const today = dateStringToDate(getTodayString());
    const target = dateStringToDate(dateText);

    if (!today || !target) return 99999;

    return Math.floor((today - target) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateText) {
    const parts = String(dateText || "").split("-");

    if (parts.length !== 3) return dateText;

    return `${Number(parts[1])}/${Number(parts[2])}`;
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

function getNumberOrNull(valueText) {
    if (valueText === "" || valueText === undefined || valueText === null) return null;

    const value = Number(valueText);

    return Number.isNaN(value) ? null : value;
}

function averageNumber(values) {
    const filtered = values.filter(value => value !== null && value !== undefined && !Number.isNaN(value));

    if (filtered.length === 0) return null;

    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function averageText(values, unit) {
    const average = averageNumber(values);

    if (average === null) return "未計算";
    if (unit === "%") return `${average.toFixed(1)}%`;
    if (unit === "時間") return `${average.toFixed(1)}時間`;

    return average.toFixed(1);
}

function valueOrDash(value) {
    return value === undefined || value === null || value === "" ? "未入力" : value;
}

function normalizeTime(text) {
    const raw = String(text || "").trim();

    if (/^\d{1,2}$/.test(raw)) {
        return `${String(Number(raw)).padStart(2, "0")}:00`;
    }

    if (/^\d{1,2}:\d{2}$/.test(raw)) {
        const [hour, minute] = raw.split(":");
        return `${String(Number(hour)).padStart(2, "0")}:${minute}`;
    }

    return "";
}

// ==============================
// ページ切り替え
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

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "analysisPage") {
        setTimeout(updateCharts, 80);
    }
}

function setupPageTabs() {
    document.querySelectorAll(".page-tab, .page-jump-button").forEach(button => {
        button.addEventListener("click", () => {
            const pageId = button.dataset.pageTarget;
            if (pageId) showPage(pageId);
        });
    });
}

// ==============================
// 基本ストレージ
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
    const settings = safeJsonParse(localStorage.getItem(SETTINGS_KEY), {});

    return {
        defaultPlannedBedtime: settings.defaultPlannedBedtime || "",
        defaultPlannedWakeTime: settings.defaultPlannedWakeTime || ""
    };
}

function setSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getGoal() {
    const goal = safeJsonParse(localStorage.getItem(GOAL_KEY), {});

    return {
        title: goal.title || "",
        reason: goal.reason || "",
        priorityItem: goal.priorityItem || "",
        minimumMinutes: goal.minimumMinutes || "",
        standardMinutes: goal.standardMinutes || ""
    };
}

function setGoal(goal) {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

// ==============================
// 時間計算
// ==============================

function timeToMinutes(timeText) {
    if (!timeText) return null;

    const parts = String(timeText).split(":");

    if (parts.length !== 2) return null;

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    return hours * 60 + minutes;
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

    if (hours === null) return null;

    return Math.round(hours * 60);
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

    const rounded = Math.round(minutes);

    if (rounded === 0) return "±0分";

    const sign = rounded > 0 ? "+" : "-";
    const abs = Math.abs(rounded);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;

    if (hours === 0) return `${sign}${mins}分`;
    if (mins === 0) return `${sign}${hours}時間`;

    return `${sign}${hours}時間${mins}分`;
}

function calculateSleepEfficiencyFromRecord(record) {
    if (!record) return null;

    const timeInBed = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const sleepHours = getNumberOrNull(record.sleepHours);

    if (timeInBed === null || sleepHours === null || timeInBed <= 0 || sleepHours <= 0) return null;

    return sleepHours / timeInBed * 100;
}

function calculateAchievementFromRecord(record) {
    if (!record) return null;

    const bedtimeGap = calculateClockGapMinutes(record.plannedBedtime, record.bedtime);
    const wakeTimeGap = calculateClockGapMinutes(record.plannedWakeTime, record.wakeTime);
    const plannedTimeInBed = calculateTimeInBedHours(record.plannedBedtime, record.plannedWakeTime);
    const actualTimeInBed = calculateTimeInBedHours(record.bedtime, record.wakeTime);

    let timeInBedGap = null;

    if (plannedTimeInBed !== null && actualTimeInBed !== null) {
        timeInBedGap = Math.round((actualTimeInBed - plannedTimeInBed) * 60);
    }

    const canJudgeAchievement = bedtimeGap !== null && wakeTimeGap !== null;

    return {
        bedtimeGap,
        wakeTimeGap,
        timeInBedGap,
        canJudgeAchievement,
        achieved: canJudgeAchievement && Math.abs(bedtimeGap) <= 30 && Math.abs(wakeTimeGap) <= 30
    };
}

function setSummaryClass(element, value, type) {
    if (!element) return;

    element.classList.remove("good", "warning", "danger");

    if (value === null || value === undefined || Number.isNaN(value)) return;

    if (type === "gap") {
        const abs = Math.abs(value);

        if (abs <= 15) element.classList.add("good");
        else if (abs <= 60) element.classList.add("warning");
        else element.classList.add("danger");
    }

    if (type === "achievement") {
        if (value >= 70) element.classList.add("good");
        else if (value >= 40) element.classList.add("warning");
        else element.classList.add("danger");
    }
}

function isNightShiftWorkType(workType) {
    return workType === "夜勤務";
}

function isNightTimeSchedule(schedule) {
    const start = timeToMinutes(schedule.actualStart || schedule.plannedStart);
    const end = timeToMinutes(schedule.actualEnd || schedule.plannedEnd);

    if (start === null || end === null) return false;

    if (end <= start) return true;

    return start >= 21 * 60 || start < 5 * 60 || end > 22 * 60 || end <= 8 * 60;
}

function inferWorkTypeFromSchedule(schedule) {
    if (!schedule || schedule.category !== "勤務") return "";

    const start = schedule.actualStart || schedule.plannedStart;
    const end = schedule.actualEnd || schedule.plannedEnd;

    if (!start && !end) return "応援勤務";
    if (!start || !end) return "応援勤務";

    if (isNightTimeSchedule(schedule)) return "夜勤務";

    const hours = calculateTimeInBedHours(start, end);

    if (hours !== null && hours <= 4) return "短時間勤務";

    return "昼勤務";
}

// ==============================
// 取り組み項目
// ==============================

function normalizeSubjectConfigs(raw) {
    if (!Array.isArray(raw)) return cloneData(defaultSubjectConfigs);

    if (raw.length === 0) return [];

    if (typeof raw[0] === "string") {
        return raw
            .map(name => String(name).trim())
            .filter(name => name !== "")
            .map(name => ({ name, subSubjects: [] }));
    }

    return raw
        .map(item => {
            if (!item) return null;

            const name = String(item.name || "").trim();

            if (!name) return null;

            const subSubjects = Array.isArray(item.subSubjects)
                ? item.subSubjects.map(sub => String(sub).trim()).filter(sub => sub !== "")
                : [];

            return {
                name,
                subSubjects: [...new Set(subSubjects)]
            };
        })
        .filter(Boolean);
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
    return getSubjectConfigs().map(item => item.name);
}

function getSubSubjectsFor(parentName) {
    const found = getSubjectConfigs().find(item => item.name === parentName);

    return found ? found.subSubjects : [];
}

function updateSubjectSelectOptions(selectedValue) {
    const select = $("mainSubject");

    if (!select) return;

    const subjects = getSubjectNames();

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未選択";
    select.appendChild(empty);

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        select.appendChild(option);
    });

    if (selectedValue && !subjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";

    updateSubSubjectSelectOptions($("subSubject")?.value || "");
}

function updateSubSubjectSelectOptions(selectedValue) {
    const parent = $("mainSubject")?.value || "";
    const select = $("subSubject");

    if (!select) return;

    const subSubjects = getSubSubjectsFor(parent);

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未選択";
    select.appendChild(empty);

    subSubjects.forEach(sub => {
        const option = document.createElement("option");
        option.value = sub;
        option.textContent = sub;
        select.appendChild(option);
    });

    if (selectedValue && !subSubjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";
}

function updateGoalPriorityOptions(selectedValue) {
    const select = $("goalPriorityItem");

    if (!select) return;

    const subjects = getSubjectNames();

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未選択";
    select.appendChild(empty);

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        select.appendChild(option);
    });

    if (selectedValue && !subjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";
}

function updateScheduleLinkedSubjectOptions(selectedValue) {
    const select = $("scheduleLinkedSubject");

    if (!select) return;

    const subjects = getSubjectNames();

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "関連なし";
    select.appendChild(empty);

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        select.appendChild(option);
    });

    if (selectedValue && !subjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";

    updateScheduleLinkedSubSubjectOptions($("scheduleLinkedSubSubject")?.value || "");
}

function updateScheduleLinkedSubSubjectOptions(selectedValue) {
    const parent = $("scheduleLinkedSubject")?.value || "";
    const select = $("scheduleLinkedSubSubject");

    if (!select) return;

    const subSubjects = getSubSubjectsFor(parent);

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "関連なし";
    select.appendChild(empty);

    subSubjects.forEach(sub => {
        const option = document.createElement("option");
        option.value = sub;
        option.textContent = sub;
        select.appendChild(option);
    });

    if (selectedValue && !subSubjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        select.appendChild(option);
    }

    select.value = selectedValue || "";
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

    if (configs.some(item => item.name === name)) {
        alert("同じ親項目名がすでにあります。");
        return;
    }

    configs.push({ name, subSubjects: [] });

    setSubjectConfigs(configs);

    input.value = "";

    loadSubjectsToUI();
    updateAllDisplays();
    updateSaveStatus(`親項目を追加しました：${name}`, false);
}

function deleteSubject(subjectName) {
    const configs = getSubjectConfigs();

    if (!confirm(`「${subjectName}」を親項目リストから削除しますか？\n過去の記録データは削除されません。`)) return;

    setSubjectConfigs(configs.filter(item => item.name !== subjectName));

    loadSubjectsToUI();
    updateAllDisplays();
}

function addSubSubject(parentName, input) {
    if (!input) return;

    const subName = input.value.trim();

    if (!subName) {
        alert("追加する子項目名を入力してください。");
        return;
    }

    const configs = getSubjectConfigs();
    const parent = configs.find(item => item.name === parentName);

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
    if (!confirm(`「${parentName}」の子項目「${subName}」を削除しますか？\n過去の記録データは削除されません。`)) return;

    const configs = getSubjectConfigs();
    const parent = configs.find(item => item.name === parentName);

    if (!parent) return;

    parent.subSubjects = parent.subSubjects.filter(item => item !== subName);

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
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "取り組み項目はまだありません。必要な親項目を追加してください。";
        list.appendChild(empty);
        return;
    }

    configs.forEach(config => {
        const item = document.createElement("div");
        item.className = "subject-setting-item";

        const main = document.createElement("div");
        main.className = "subject-setting-main";

        const name = document.createElement("span");
        name.className = "subject-setting-name";
        name.textContent = config.name;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "subject-delete-button";
        deleteButton.textContent = "親項目を削除";
        deleteButton.addEventListener("click", () => deleteSubject(config.name));

        main.appendChild(name);
        main.appendChild(deleteButton);

        const subBox = document.createElement("div");
        subBox.className = "subsubject-box";

        const subList = document.createElement("div");
        subList.className = "subsubject-list";

        if (config.subSubjects.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "子項目は未設定です。";
            subList.appendChild(empty);
        } else {
            config.subSubjects.forEach(sub => {
                const subItem = document.createElement("div");
                subItem.className = "subsubject-item";

                const subName = document.createElement("span");
                subName.className = "subsubject-name";
                subName.textContent = sub;

                const subDelete = document.createElement("button");
                subDelete.type = "button";
                subDelete.className = "subsubject-delete-button";
                subDelete.textContent = "削除";
                subDelete.addEventListener("click", () => deleteSubSubject(config.name, sub));

                subItem.appendChild(subName);
                subItem.appendChild(subDelete);
                subList.appendChild(subItem);
            });
        }

        const inputRow = document.createElement("div");
        inputRow.className = "subsubject-input-row";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "例：テキスト、問題集、動画、復習";

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "subsubject-add-button";
        addButton.textContent = "子項目追加";
        addButton.addEventListener("click", () => addSubSubject(config.name, input));

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addSubSubject(config.name, input);
            }
        });

        inputRow.appendChild(input);
        inputRow.appendChild(addButton);

        subBox.appendChild(subList);
        subBox.appendChild(inputRow);

        item.appendChild(main);
        item.appendChild(subBox);

        list.appendChild(item);
    });
}

// ==============================
// 継続項目
// ==============================

function normalizeHabits(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
        .map(item => {
            if (!item) return null;

            const name = String(item.name || "").trim();

            if (!name) return null;

            return {
                id: item.id || createId("habit"),
                name,
                type: item.type === "avoid" ? "avoid" : "action",
                createdAt: item.createdAt || new Date().toISOString()
            };
        })
        .filter(Boolean);
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
    const records = safeJsonParse(localStorage.getItem(HABIT_RECORDS_KEY), {});

    if (!records || typeof records !== "object" || Array.isArray(records)) return {};

    return records;
}

function setHabitRecords(records) {
    localStorage.setItem(HABIT_RECORDS_KEY, JSON.stringify(records));
}

function getHabitResult(date, habitId) {
    const records = getHabitRecords();

    if (!records[date] || !records[date][habitId]) return null;

    return records[date][habitId].result === true;
}

function setHabitResult(date, habitId, result) {
    const records = getHabitRecords();

    if (!records[date]) records[date] = {};

    records[date][habitId] = {
        result,
        updatedAt: new Date().toISOString()
    };

    setHabitRecords(records);

    updateAllDisplays();
    updateSaveStatus(`継続項目を記録しました：${date}`, false);
}

function clearHabitResult(date, habitId) {
    const records = getHabitRecords();

    if (records[date] && records[date][habitId]) {
        delete records[date][habitId];
    }

    setHabitRecords(records);
    updateAllDisplays();
}

function getHabitState(date, habitId) {
    const result = getHabitResult(date, habitId);

    if (result === true) return "done";
    if (result === false) return "failed";

    return "pending";
}

function getHabitStreakUntil(date, habitId) {
    let count = 0;
    let cursor = date;

    for (let i = 0; i < 1000; i++) {
        if (getHabitResult(cursor, habitId) === true) {
            count += 1;
            cursor = addDays(cursor, -1);
        } else {
            break;
        }
    }

    return count;
}

function getHabitAchievementRate(habitId, days) {
    const dates = getRecentDates(days);
    let achieved = 0;

    dates.forEach(date => {
        if (getHabitResult(date, habitId) === true) achieved += 1;
    });

    return {
        achieved,
        recorded: dates.length,
        rate: days === 0 ? 0 : achieved / days * 100
    };
}

function getHabitAchievementCount(date) {
    return getHabits().filter(habit => getHabitResult(date, habit.id) === true).length;
}

function getHabitPendingCount(date) {
    return getHabits().filter(habit => getHabitResult(date, habit.id) === null).length;
}

function updateHabitTodaySummary(date) {
    const habits = getHabits();
    const done = getHabitAchievementCount(date);
    const pending = getHabitPendingCount(date);
    let topStreak = 0;

    habits.forEach(habit => {
        topStreak = Math.max(topStreak, getHabitStreakUntil(date, habit.id));
    });

    setText("habitTodayDoneCount", `${done}件`);
    setText("habitTodayPendingCount", `${pending}件`);
    setText("habitTodayTopStreak", topStreak > 0 ? `${topStreak}日` : "なし");
}

function getHabitStatusText(habit, date) {
    const result = getHabitResult(date, habit.id);
    const streak = getHabitStreakUntil(date, habit.id);

    if (result === true) return `今日達成済み。現在 ${streak}日継続中。`;
    if (result === false) return habit.type === "avoid" ? "今日は途切れた記録です。" : "今日は未達成の記録です。";

    const yesterdayStreak = getHabitStreakUntil(addDays(date, -1), habit.id);

    if (yesterdayStreak > 0) {
        return `昨日まで ${yesterdayStreak}日継続中。今日もできたら継続です。`;
    }

    return "今日の記録はまだありません。";
}

function shouldShowHabitByFilter(date, habit) {
    const state = getHabitState(date, habit.id);

    if (habitFilter === "all") return true;

    return state === habitFilter;
}

function renderTodayHabitList() {
    const list = $("todayHabitList");

    if (!list) return;

    const date = $("recordDate")?.value || getTodayString();
    const habits = getHabits();

    updateHabitTodaySummary(date);

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目はまだありません。設定ページで追加してください。";
        list.appendChild(empty);
        return;
    }

    const visibleHabits = habits.filter(habit => shouldShowHabitByFilter(date, habit));

    if (visibleHabits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "この条件に当てはまる継続項目はありません。";
        list.appendChild(empty);
        return;
    }

    visibleHabits.forEach(habit => {
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
                <span class="today-habit-type ${typeClass}">${typeText}</span>
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

    list.querySelectorAll("[data-habit-success]").forEach(button => {
        button.addEventListener("click", () => setHabitResult(date, button.dataset.habitSuccess, true));
    });

    list.querySelectorAll("[data-habit-fail]").forEach(button => {
        button.addEventListener("click", () => setHabitResult(date, button.dataset.habitFail, false));
    });

    list.querySelectorAll("[data-habit-clear]").forEach(button => {
        button.addEventListener("click", () => clearHabitResult(date, button.dataset.habitClear));
    });
}

function addHabit() {
    const nameInput = $("newHabitName");
    const typeSelect = $("newHabitType");

    if (!nameInput || !typeSelect) return;

    const name = nameInput.value.trim();
    const type = typeSelect.value === "avoid" ? "avoid" : "action";

    if (!name) {
        alert("追加する継続項目名を入力してください。");
        return;
    }

    const habits = getHabits();

    if (habits.some(habit => habit.name === name)) {
        alert("同じ継続項目名がすでにあります。");
        return;
    }

    habits.push({
        id: createId("habit"),
        name,
        type,
        createdAt: new Date().toISOString()
    });

    setHabits(habits);

    nameInput.value = "";

    renderHabitSettingsList();
    updateAllDisplays();
}

function deleteHabit(habitId) {
    const habits = getHabits();
    const habit = habits.find(item => item.id === habitId);

    if (!habit) return;

    if (!confirm(`継続項目「${habit.name}」を削除しますか？\n過去の達成記録は残ります。`)) return;

    setHabits(habits.filter(item => item.id !== habitId));

    renderHabitSettingsList();
    updateAllDisplays();
}

function renderHabitSettingsList() {
    const list = $("habitSettingsList");

    if (!list) return;

    const habits = getHabits();

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目はまだありません。必要な項目を追加してください。";
        list.appendChild(empty);
        return;
    }

    habits.forEach(habit => {
        const item = document.createElement("div");
        item.className = "habit-setting-item";

        const typeText = habit.type === "avoid"
            ? "回避型：途切れなければ達成"
            : "実行型：やったら達成";

        item.innerHTML = `
            <div>
                <span class="habit-setting-name">${escapeHtml(habit.name)}</span>
                <span class="habit-setting-detail">${typeText}</span>
            </div>
            <button type="button" class="habit-delete-button" data-habit-delete="${habit.id}">削除</button>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-habit-delete]").forEach(button => {
        button.addEventListener("click", () => deleteHabit(button.dataset.habitDelete));
    });
}

// ==============================
// 予定テンプレート v9.0
// ==============================

function normalizeScheduleTemplates(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
        .map(item => {
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
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString()
            };
        })
        .filter(Boolean);
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

function makeScheduleTemplateName(data) {
    const category = data.category || "その他";
    const title = data.title || category;
    const start = data.plannedStart || "";
    const end = data.plannedEnd || "";
    const time = start && end ? ` ${start}-${end}` : "";
    const place = data.place ? ` ${data.place}` : "";

    return `${category}：${title}${time}${place}`.trim();
}

function getScheduleTemplateFromForm() {
    const schedule = getScheduleFormData();

    return {
        id: "",
        name: makeScheduleTemplateName(schedule),
        category: schedule.category || "その他",
        title: schedule.title || schedule.category || "予定",
        plannedStart: schedule.plannedStart || "",
        plannedEnd: schedule.plannedEnd || "",
        place: schedule.place || "",
        linkedSubject: schedule.linkedSubject || "",
        linkedSubSubject: schedule.linkedSubSubject || "",
        memo: schedule.memo || "",
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

    if (!template.category) {
        alert("テンプレート化するカテゴリを選択してください。");
        return;
    }

    const templates = getScheduleTemplates();

    const same = templates.find(item => {
        return item.category === template.category
            && item.title === template.title
            && item.plannedStart === template.plannedStart
            && item.plannedEnd === template.plannedEnd
            && item.place === template.place
            && item.linkedSubject === template.linkedSubject
            && item.linkedSubSubject === template.linkedSubSubject
            && item.memo === template.memo;
    });

    if (same && !confirm("同じ内容のテンプレートがすでにあります。それでも追加しますか？")) {
        return;
    }

    const customName = prompt("テンプレート名を入力してください。", template.name);

    if (customName === null) return;

    template.name = customName.trim() || template.name;
    template.id = createId("schedule_template");

    templates.push(template);
    setScheduleTemplates(templates);

    renderScheduleTemplateList();
    updateSetupChecklist();
    setText("scheduleStatus", `テンプレート化しました：${template.name}`);
}

function applyScheduleTemplate(templateId) {
    const template = getScheduleTemplates().find(item => item.id === templateId);

    if (!template) return;

    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();

    setScheduleFormData({
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
        memo: template.memo || ""
    });

    setText("scheduleStatus", `テンプレートを反映しました：${template.name}`);
    showPage("schedulePage");
}

function addScheduleTemplateDirectly(templateId) {
    const template = getScheduleTemplates().find(item => item.id === templateId);

    if (!template) return;

    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();

    const schedule = {
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
    };

    saveScheduleItem(schedule);

    setText("scheduleStatus", `テンプレートから予定を追加しました：${date} ${template.name}`);
    updateAllDisplays();
}

function editScheduleTemplate(templateId) {
    const template = getScheduleTemplates().find(item => item.id === templateId);

    if (!template) return;

    applyScheduleTemplate(templateId);
    setText("scheduleStatus", `テンプレートを編集用に反映しました。修正後、「この内容をテンプレート化」で新規保存してください：${template.name}`);
}

function deleteScheduleTemplate(templateId) {
    const templates = getScheduleTemplates();
    const target = templates.find(item => item.id === templateId);

    if (!target) return;

    if (!confirm(`テンプレート「${target.name}」を削除しますか？`)) return;

    setScheduleTemplates(templates.filter(item => item.id !== templateId));

    renderScheduleTemplateList();
    updateSetupChecklist();
    setText("scheduleStatus", `テンプレートを削除しました：${target.name}`);
}

function renderScheduleTemplateList() {
    const list = $("scheduleTemplateList");

    if (!list) return;

    const templates = getScheduleTemplates();

    list.innerHTML = "";

    if (templates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "テンプレートはまだありません。予定作成カードで内容を入力し、「この内容をテンプレート化」を押してください。";
        list.appendChild(empty);
        return;
    }

    templates.forEach(template => {
        const item = document.createElement("div");
        item.className = "schedule-template-item";

        const timeText = template.plannedStart && template.plannedEnd
            ? `${template.plannedStart}-${formatTimeWithNextDay(template.plannedStart, template.plannedEnd)}`
            : "時刻なし";

        const placeText = template.place ? ` / ${template.place}` : "";
        const linkedText = template.linkedSubject
            ? ` / ${template.linkedSubject}${template.linkedSubSubject ? "・" + template.linkedSubSubject : ""}`
            : "";

        item.innerHTML = `
            <div class="schedule-template-header">
                <div>
                    <span class="schedule-template-title">${escapeHtml(template.name)}</span>
                    <span class="schedule-template-meta">${escapeHtml(template.category)}：${escapeHtml(template.title)} / ${escapeHtml(timeText)}${escapeHtml(placeText)}${escapeHtml(linkedText)}</span>
                </div>
            </div>
            ${template.memo ? `<p class="schedule-template-memo">${escapeHtml(template.memo)}</p>` : ""}
            <div class="schedule-template-actions">
                <button type="button" class="template-direct-add-button" data-template-direct-add="${template.id}">この日に追加</button>
                <button type="button" class="template-use-button" data-template-use="${template.id}">入力欄へ</button>
                <button type="button" class="template-edit-button" data-template-edit="${template.id}">編集用</button>
                <button type="button" class="template-delete-button" data-template-delete="${template.id}">削除</button>
            </div>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-template-direct-add]").forEach(button => {
        button.addEventListener("click", () => addScheduleTemplateDirectly(button.dataset.templateDirectAdd));
    });

    list.querySelectorAll("[data-template-use]").forEach(button => {
        button.addEventListener("click", () => applyScheduleTemplate(button.dataset.templateUse));
    });

    list.querySelectorAll("[data-template-edit]").forEach(button => {
        button.addEventListener("click", () => editScheduleTemplate(button.dataset.templateEdit));
    });

    list.querySelectorAll("[data-template-delete]").forEach(button => {
        button.addEventListener("click", () => deleteScheduleTemplate(button.dataset.templateDelete));
    });
}

// ==============================
// 予定
// ==============================

function getSchedules() {
    const schedules = safeJsonParse(localStorage.getItem(SCHEDULE_KEY), {});

    if (!schedules || typeof schedules !== "object" || Array.isArray(schedules)) return {};

    return schedules;
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
    const schedule = getScheduleFormData();

    if (!schedule.date) {
        alert("予定日を入力してください。");
        return;
    }

    if (!schedule.title && schedule.category !== "休み") {
        alert("予定名を入力してください。");
        return;
    }

    if (schedule.category !== "休み" && (!schedule.plannedStart || !schedule.plannedEnd)) {
        if (!confirm("開始時刻または終了時刻が空欄です。このまま保存しますか？")) return;
    }

    if (schedule.category === "休み" && !schedule.title) {
        schedule.title = "休み";
    }

    saveScheduleItem(schedule);

    scheduleFocusDate = schedule.date;

    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = schedule.date;

    setText("scheduleStatus", `保存しました：${schedule.date} ${schedule.category}`);

    clearScheduleForm();
    updateAllDisplays();
}

function editSchedule(date, id) {
    const target = getSchedulesForDate(date).find(item => item.id === id);

    if (!target) return;

    scheduleFocusDate = date;

    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;

    setScheduleFormData(target);
    setText("scheduleStatus", `編集中：${date}`);
    showPage("schedulePage");
}

function duplicateScheduleFromForm() {
    const schedule = getScheduleFormData();

    if (!schedule.title && schedule.category !== "休み") {
        alert("複製する予定がありません。先に予定を編集するか入力してください。");
        return;
    }

    schedule.id = "";
    schedule.date = $("scheduleDate")?.value || scheduleFocusDate || getTodayString();

    saveScheduleItem(schedule);

    setText("scheduleStatus", `複製しました：${schedule.date} ${schedule.title || schedule.category}`);
    updateAllDisplays();
}

function getScheduleHours(schedule) {
    const start = schedule.actualStart || schedule.plannedStart;
    const end = schedule.actualEnd || schedule.plannedEnd;

    return calculateTimeInBedHours(start, end);
}

function getScheduleClass(schedule) {
    if (schedule.category === "勤務") return "work";
    if (schedule.category === "学習" || schedule.category === "講義" || schedule.category === "学校") return "study";
    if (schedule.category === "休み") return "rest";

    return "";
}

function scheduleLineText(schedule) {
    const start = schedule.actualStart || schedule.plannedStart;
    const end = schedule.actualEnd || schedule.plannedEnd;
    const timeText = start && end ? `${start}-${formatTimeWithNextDay(start, end)}` : "時刻未設定";
    const place = schedule.place ? ` / ${schedule.place}` : "";
    const linked = schedule.linkedSubject
        ? ` / ${schedule.linkedSubject}${schedule.linkedSubSubject ? "・" + schedule.linkedSubSubject : ""}`
        : "";

    return `${timeText}　${schedule.category}：${schedule.title}${place}${linked}`;
}

function renderScheduleList(containerId, date) {
    const list = $(containerId);

    if (!list) return;

    const schedules = getSchedulesForDate(date);

    list.innerHTML = "";

    if (schedules.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "予定はありません。";
        list.appendChild(empty);
        return;
    }

    schedules.forEach(schedule => {
        const item = document.createElement("div");
        item.className = `today-schedule-item ${getScheduleClass(schedule)}`;

        item.innerHTML = `
            <span class="today-schedule-title">${escapeHtml(schedule.category)}：${escapeHtml(schedule.title)}</span>
            <span class="today-schedule-meta">${escapeHtml(scheduleLineText(schedule))}</span>
            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="inline-small-button" data-schedule-edit="${schedule.id}" data-schedule-date="${date}">編集</button>
                <button type="button" class="inline-small-button" data-schedule-copy="${schedule.id}" data-schedule-date="${date}">複製</button>
                <button type="button" class="inline-danger-button" data-schedule-delete="${schedule.id}" data-schedule-date="${date}">削除</button>
            </div>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-schedule-edit]").forEach(button => {
        button.addEventListener("click", () => editSchedule(button.dataset.scheduleDate, button.dataset.scheduleEdit));
    });

    list.querySelectorAll("[data-schedule-copy]").forEach(button => {
        button.addEventListener("click", () => {
            const source = getSchedulesForDate(button.dataset.scheduleDate).find(item => item.id === button.dataset.scheduleCopy);

            if (!source) return;

            const copy = { ...source, id: "", date: scheduleFocusDate || button.dataset.scheduleDate };

            setScheduleFormData(copy);
            setText("scheduleStatus", "複製用に入力欄へ反映しました。日付を確認して保存してください。");
            showPage("schedulePage");
        });
    });

    list.querySelectorAll("[data-schedule-delete]").forEach(button => {
        button.addEventListener("click", () => {
            if (confirm("この予定を削除しますか？")) {
                deleteScheduleItem(button.dataset.scheduleDate, button.dataset.scheduleDelete);
            }
        });
    });
}

function renderTodayScheduleList() {
    const date = $("recordDate")?.value || getTodayString();

    renderScheduleList("todayScheduleList", date);
}

function renderFocusedScheduleList() {
    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();

    renderScheduleList("focusedScheduleList", date);
}

function applyScheduleToRecord() {
    const date = $("recordDate")?.value || getTodayString();
    const schedules = getSchedulesForDate(date);

    if (schedules.length === 0) {
        alert("今日の予定がありません。");
        return;
    }

    const records = getRecords();
    const record = records[date] || getFormData();

    const workSchedule = schedules.find(item => item.category === "勤務");
    const studySchedules = schedules.filter(item => {
        return ["学習", "講義", "学校", "習い事"].includes(item.category) && item.linkedSubject;
    });

    if (workSchedule) {
        record.workType = inferWorkTypeFromSchedule(workSchedule);
    } else if (schedules.some(item => item.category === "休み")) {
        record.workType = "休み";
    } else if (!record.workType && schedules.length > 0) {
        record.workType = "予定あり";
    }

    if (studySchedules.length > 0) {
        let totalMinutes = 0;
        const first = studySchedules[0];

        studySchedules.forEach(item => {
            const minutes = calculateMinutesBetween(item.actualStart || item.plannedStart, item.actualEnd || item.plannedEnd);

            if (minutes !== null) totalMinutes += minutes;
        });

        if (totalMinutes > 0) record.studyTotal = String(totalMinutes);

        record.mainSubject = first.linkedSubject || record.mainSubject || "";
        record.subSubject = first.linkedSubSubject || record.subSubject || "";
    }

    records[date] = record;
    setRecords(records);

    setFormData(record);
    updateSaveStatus(`今日の予定を日次記録へ反映しました：${date}`, false);
    updateAllDisplays();
}

// ==============================
// タスク
// ==============================

function getTasks() {
    const tasks = safeJsonParse(localStorage.getItem(TASKS_KEY), {});

    if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) return {};

    return tasks;
}

function setTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function getTasksForDate(date) {
    const tasks = getTasks();

    return Array.isArray(tasks[date]) ? tasks[date] : [];
}

function saveTaskItem(task) {
    const date = task.date;

    if (!date) return;

    const tasks = getTasks();

    if (!Array.isArray(tasks[date])) tasks[date] = [];

    if (!task.id) {
        task.id = createId("task");
        task.done = task.done === true;
        task.createdAt = new Date().toISOString();
        tasks[date].push(task);
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

        task.done = task.done === true || oldDone;

        if (!Array.isArray(tasks[date])) tasks[date] = [];
        tasks[date].push(task);
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

    tasks[date] = tasks[date].map(task => {
        if (task.id !== id) return task;

        return {
            ...task,
            done: !task.done,
            updatedAt: new Date().toISOString()
        };
    });

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
        updatedAt: new Date().toISOString()
    };
}

function setTaskFormData(task) {
    if ($("editingTaskId")) $("editingTaskId").value = task.id || "";
    if ($("taskDate")) $("taskDate").value = task.date || scheduleFocusDate || getTodayString();
    if ($("taskCategory")) $("taskCategory").value = task.category || "その他";
    if ($("taskTitle")) $("taskTitle").value = task.title || "";
    if ($("taskMemo")) $("taskMemo").value = task.memo || "";
}

function clearTaskForm() {
    setTaskFormData({
        id: "",
        date: scheduleFocusDate || $("recordDate")?.value || getTodayString(),
        category: "学習",
        title: "",
        memo: ""
    });

    setText("taskStatus", "入力をクリアしました");
}

function saveTaskFromForm() {
    const task = getTaskFormData();

    if (!task.date) {
        alert("タスク日を入力してください。");
        return;
    }

    if (!task.title) {
        alert("タスク名を入力してください。");
        return;
    }

    saveTaskItem(task);

    scheduleFocusDate = task.date;

    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = task.date;

    setText("taskStatus", `保存しました：${task.date} ${task.title}`);

    clearTaskForm();
    updateAllDisplays();
}

function editTask(date, id) {
    const target = getTasksForDate(date).find(item => item.id === id);

    if (!target) return;

    scheduleFocusDate = date;

    if ($("scheduleFocusDate")) $("scheduleFocusDate").value = date;

    setTaskFormData(target);
    setText("taskStatus", `編集中：${date}`);
    showPage("schedulePage");
}

function duplicateTaskFromForm() {
    const task = getTaskFormData();

    if (!task.title) {
        alert("複製するタスクがありません。先にタスクを編集するか入力してください。");
        return;
    }

    task.id = "";
    task.done = false;
    task.date = $("taskDate")?.value || scheduleFocusDate || getTodayString();

    saveTaskItem(task);

    setText("taskStatus", `複製しました：${task.date} ${task.title}`);
    updateAllDisplays();
}

function renderTaskList(containerId, date) {
    const list = $(containerId);

    if (!list) return;

    const tasks = getTasksForDate(date);

    list.innerHTML = "";

    if (tasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "タスクはありません。";
        list.appendChild(empty);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = `today-task-item ${task.done ? "done" : ""}`;

        item.innerHTML = `
            <div class="today-task-row">
                <input type="checkbox" class="today-task-checkbox" data-task-toggle="${task.id}" data-task-date="${date}" ${task.done ? "checked" : ""}>
                <div>
                    <span class="today-task-title">${escapeHtml(task.title)}</span>
                    <span class="today-task-meta">${escapeHtml(task.category)}${task.memo ? " / " + escapeHtml(task.memo) : ""}</span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="inline-small-button" data-task-edit="${task.id}" data-task-date="${date}">編集</button>
                    <button type="button" class="inline-small-button" data-task-copy="${task.id}" data-task-date="${date}">複製</button>
                    <button type="button" class="inline-danger-button" data-task-delete="${task.id}" data-task-date="${date}">削除</button>
                </div>
            </div>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-task-toggle]").forEach(input => {
        input.addEventListener("change", () => toggleTaskDone(input.dataset.taskDate, input.dataset.taskToggle));
    });

    list.querySelectorAll("[data-task-edit]").forEach(button => {
        button.addEventListener("click", () => editTask(button.dataset.taskDate, button.dataset.taskEdit));
    });

    list.querySelectorAll("[data-task-copy]").forEach(button => {
        button.addEventListener("click", () => {
            const source = getTasksForDate(button.dataset.taskDate).find(item => item.id === button.dataset.taskCopy);

            if (!source) return;

            const copy = { ...source, id: "", done: false, date: scheduleFocusDate || button.dataset.taskDate };

            setTaskFormData(copy);
            setText("taskStatus", "複製用に入力欄へ反映しました。日付を確認して保存してください。");
            showPage("schedulePage");
        });
    });

    list.querySelectorAll("[data-task-delete]").forEach(button => {
        button.addEventListener("click", () => {
            if (confirm("このタスクを削除しますか？")) {
                deleteTaskItem(button.dataset.taskDate, button.dataset.taskDelete);
            }
        });
    });
}

function renderTodayTaskList() {
    const date = $("recordDate")?.value || getTodayString();

    renderTaskList("todayTaskList", date);
}

function renderFocusedTaskList() {
    const date = scheduleFocusDate || $("scheduleFocusDate")?.value || $("recordDate")?.value || getTodayString();

    renderTaskList("focusedTaskList", date);
}

// ==============================
// 一括入力
// ==============================

function resolveBulkDate(text) {
    const raw = String(text || "").trim();
    const current = scheduleFocusDate || $("recordDate")?.value || getTodayString();
    const currentYear = Number(current.slice(0, 4));

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const md = raw.match(/^(\d{1,2})\/(\d{1,2})$/);

    if (md) {
        return `${currentYear}-${String(Number(md[1])).padStart(2, "0")}-${String(Number(md[2])).padStart(2, "0")}`;
    }

    return "";
}

function parseTimeRange(text) {
    const raw = String(text || "").trim();

    const matchColon = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

    if (matchColon) {
        return {
            start: normalizeTime(matchColon[1]),
            end: normalizeTime(matchColon[2])
        };
    }

    const matchHour = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);

    if (matchHour) {
        return {
            start: normalizeTime(matchHour[1]),
            end: normalizeTime(matchHour[2])
        };
    }

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

        return {
            type: "task",
            task: {
                id: "",
                date,
                category,
                title,
                memo: "",
                done: false,
                updatedAt: new Date().toISOString()
            }
        };
    }

    if (second === "休み") {
        return {
            type: "schedule",
            schedule: {
                id: "",
                date,
                category: "休み",
                title: "休み",
                plannedStart: "",
                plannedEnd: "",
                actualStart: "",
                actualEnd: "",
                place: "",
                linkedSubject: "",
                linkedSubSubject: "",
                memo: line,
                updatedAt: new Date().toISOString()
            }
        };
    }

    const range = parseTimeRange(second);

    if (range.start && range.end) {
        const title = rest || "予定";

        return {
            type: "schedule",
            schedule: {
                id: "",
                date,
                category: title.includes("勤務") ? "勤務" : "その他",
                title,
                plannedStart: range.start,
                plannedEnd: range.end,
                actualStart: "",
                actualEnd: "",
                place: "",
                linkedSubject: "",
                linkedSubSubject: "",
                memo: line,
                updatedAt: new Date().toISOString()
            }
        };
    }

    const maybeTime = parts[2] || "";
    const range2 = parseTimeRange(maybeTime);

    if (range2.start && range2.end) {
        const subjectNames = getSubjectNames();
        const foundSubject = subjectNames.find(subject => second.includes(subject) || line.includes(subject));
        const foundSub = foundSubject ? getSubSubjectsFor(foundSubject).find(sub => line.includes(sub)) : "";

        return {
            type: "schedule",
            schedule: {
                id: "",
                date,
                category: foundSubject ? "学習" : second || "その他",
                title: second || "予定",
                plannedStart: range2.start,
                plannedEnd: range2.end,
                actualStart: "",
                actualEnd: "",
                place: "",
                linkedSubject: foundSubject || "",
                linkedSubSubject: foundSub || "",
                memo: line,
                updatedAt: new Date().toISOString()
            }
        };
    }

    return {
        type: "task",
        task: {
            id: "",
            date,
            category: "その他",
            title: parts.slice(1).join(" ").trim() || "タスク",
            memo: "",
            done: false,
            updatedAt: new Date().toISOString()
        }
    };
}

function importBulkScheduleText() {
    const textarea = $("bulkScheduleText");

    if (!textarea) return;

    const lines = textarea.value
        .split("\n")
        .map(line => line.trim())
        .filter(line => line !== "");

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
            errorCount += 1;
            return;
        }

        if (parsed.type === "schedule") {
            saveScheduleItem(parsed.schedule);
            scheduleCount += 1;
        } else {
            saveTaskItem(parsed.task);
            taskCount += 1;
        }
    });

    textarea.value = "";

    setText("bulkImportStatus", `一括登録完了：予定${scheduleCount}件、タスク${taskCount}件、失敗${errorCount}件`);

    updateAllDisplays();
}

// ==============================
// 月間予定・カレンダー
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

    const [year, monthNumber] = month.split("-").map(Number);
    const firstDate = new Date(year, monthNumber - 1, 1);
    const firstWeekday = firstDate.getDay();
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const today = getTodayString();
    const selected = scheduleFocusDate || $("scheduleFocusDate")?.value || today;

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    grid.innerHTML = "";

    weekdays.forEach(day => {
        const weekday = document.createElement("div");
        weekday.className = "monthly-calendar-weekday";
        weekday.textContent = day;
        grid.appendChild(weekday);
    });

    for (let i = 0; i < firstWeekday; i++) {
        const empty = document.createElement("div");
        empty.className = "monthly-calendar-day outside";
        grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDay; day++) {
        const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const schedules = getSchedulesForDate(date);
        const tasks = getTasksForDate(date);
        const workCount = schedules.filter(item => item.category === "勤務").length;
        const restCount = schedules.filter(item => item.category === "休み").length;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "monthly-calendar-day";

        if (date === today) button.classList.add("today");
        if (date === selected) button.classList.add("selected");

        const badges = [];

        if (schedules.length > 0) badges.push(`<span class="monthly-calendar-badge schedule">予${schedules.length}</span>`);
        if (tasks.length > 0) badges.push(`<span class="monthly-calendar-badge task">タ${tasks.length}</span>`);
        if (workCount > 0) badges.push(`<span class="monthly-calendar-badge work">勤${workCount}</span>`);
        if (restCount > 0) badges.push(`<span class="monthly-calendar-badge rest">休</span>`);

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
        const dayTasks = Array.isArray(tasks[date]) ? tasks[date] : [];

        if (daySchedules.length === 0 && dayTasks.length === 0) return;

        scheduleCount += daySchedules.length;
        taskCount += dayTasks.length;
        taskDone += dayTasks.filter(task => task.done).length;

        const dayItem = document.createElement("div");
        dayItem.className = "month-day-item";

        const lines = [];

        daySchedules.forEach(schedule => {
            lines.push(`<div class="month-plan-line schedule">${escapeHtml(scheduleLineText(schedule))}</div>`);
        });

        dayTasks.forEach(task => {
            lines.push(`<div class="month-plan-line task ${task.done ? "done" : ""}">☑ ${escapeHtml(task.category)}：${escapeHtml(task.title)}</div>`);
        });

        dayItem.innerHTML = `
            <div class="month-day-header">${date}（${formatShortDate(date)}）</div>
            <div class="month-day-content">
                ${lines.join("")}
            </div>
        `;

        list.appendChild(dayItem);
    });

    if (list.children.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "この月の予定・タスクはありません。";
        list.appendChild(empty);
    }

    setText("monthScheduleCount", `${scheduleCount}件`);
    setText("monthTaskCount", `${taskCount}件`);
    setText("monthTaskDoneRate", taskCount === 0 ? "未計算" : `${Math.round(taskDone / taskCount * 100)}%`);

    renderMonthlyCalendarGrid();
}

// ==============================
// 日次記録
// ==============================

function getFormData() {
    const data = {};

    fieldIds.forEach(id => {
        const element = $(id);

        if (element) data[id] = element.value;
    });

    return data;
}

function setFormData(data) {
    updateSubjectSelectOptions(data.mainSubject || "");
    updateSubSubjectSelectOptions(data.subSubject || "");

    fieldIds.forEach(id => {
        const element = $(id);

        if (element) element.value = data[id] ?? "";
    });

    const settings = getSettings();

    if (!data.plannedBedtime && $("plannedBedtime")) $("plannedBedtime").value = settings.defaultPlannedBedtime;
    if (!data.plannedWakeTime && $("plannedWakeTime")) $("plannedWakeTime").value = settings.defaultPlannedWakeTime;

    updateRatingDisplays();
    updateCalculatedDisplays();
}

function clearForm() {
    fieldIds.forEach(id => {
        const element = $(id);

        if (element) element.value = "";
    });

    updateSubSubjectSelectOptions("");
    updateRatingDisplays();
    updateCalculatedDisplays();
}

function applyDefaultPlanToForm() {
    const settings = getSettings();

    if ($("plannedBedtime")) $("plannedBedtime").value = settings.defaultPlannedBedtime;
    if ($("plannedWakeTime")) $("plannedWakeTime").value = settings.defaultPlannedWakeTime;
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
        warnings.length > 0
            ? `保存しました：${date} ${getCurrentTimeString()}　※確認あり`
            : `保存しました：${date} ${getCurrentTimeString()}`,
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
// 睡眠・チェック・助言
// ==============================

function updateSleepSummary() {
    const record = getFormData();
    const plannedTimeInBed = calculateTimeInBedHours(record.plannedBedtime, record.plannedWakeTime);
    const actualTimeInBed = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const efficiency = calculateSleepEfficiencyFromRecord(record);
    const achievement = calculateAchievementFromRecord(record);

    setText("plannedTimeInBed", plannedTimeInBed === null ? "未計算" : `${plannedTimeInBed.toFixed(1)}時間`);
    setText("timeInBed", actualTimeInBed === null ? "未計算" : `${actualTimeInBed.toFixed(1)}時間`);

    const efficiencyElement = $("sleepEfficiency");

    if (efficiencyElement) {
        efficiencyElement.classList.remove("good", "warning", "danger");

        if (efficiency === null) {
            efficiencyElement.textContent = "未計算";
        } else if (efficiency > 100) {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}% 要確認`;
            efficiencyElement.classList.add("danger");
        } else if (efficiency < 70) {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}% 低め`;
            efficiencyElement.classList.add("warning");
        } else {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}%`;
            efficiencyElement.classList.add("good");
        }
    }

    const timeInBedGap = achievement ? achievement.timeInBedGap : null;
    const bedtimeGap = achievement ? achievement.bedtimeGap : null;
    const wakeTimeGap = achievement ? achievement.wakeTimeGap : null;

    const timeInBedGapElement = $("timeInBedGap");
    const bedtimeGapElement = $("bedtimeGap");
    const wakeTimeGapElement = $("wakeTimeGap");

    if (timeInBedGapElement) {
        timeInBedGapElement.textContent = formatGapMinutes(timeInBedGap);
        setSummaryClass(timeInBedGapElement, timeInBedGap, "gap");
    }

    if (bedtimeGapElement) {
        bedtimeGapElement.textContent = formatGapMinutes(bedtimeGap);
        setSummaryClass(bedtimeGapElement, bedtimeGap, "gap");
    }

    if (wakeTimeGapElement) {
        wakeTimeGapElement.textContent = formatGapMinutes(wakeTimeGap);
        setSummaryClass(wakeTimeGapElement, wakeTimeGap, "gap");
    }
}

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
    const record = getFormData();

    const actualTimeInBed = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const plannedTimeInBed = calculateTimeInBedHours(record.plannedBedtime, record.plannedWakeTime);
    const sleepHours = getNumberOrNull(record.sleepHours);
    const studyTotal = getNumberOrNull(record.studyTotal);

    if (plannedTimeInBed !== null && plannedTimeInBed > 14) {
        warnings.push("予定在床時間が14時間を超えています。予定時刻を確認してください");
    }

    if (actualTimeInBed !== null && actualTimeInBed > 16) {
        warnings.push("実際在床時間が16時間を超えています。就寝・起床時刻を確認してください");
    }

    if (record.sleepHours !== "") {
        if (sleepHours === null) warnings.push("実睡眠時間は数値で入力してください");
        else {
            if (sleepHours < 0) warnings.push("実睡眠時間は0以上で入力してください");
            if (sleepHours > 16) warnings.push("実睡眠時間が16時間を超えています。入力値を確認してください");
            if (actualTimeInBed !== null && sleepHours > actualTimeInBed) {
                warnings.push("実睡眠時間が実際在床時間を超えています。入力値を確認してください");
            }
        }
    }

    warnings.push(...checkRange(record.mood, "気分", 1, 10));
    warnings.push(...checkRange(record.sleepiness, "眠気", 1, 10));
    warnings.push(...checkRange(record.fatigue, "疲労", 1, 10));
    warnings.push(...checkRange(record.focus, "集中力", 1, 10));

    if (record.studyTotal !== "") {
        if (studyTotal === null) warnings.push("取り組み時間は数値で入力してください");
        else if (studyTotal < 0) warnings.push("取り組み時間は0分以上で入力してください");
        else if (studyTotal > 960) warnings.push("取り組み時間が16時間を超えています。入力値を確認してください");
    }

    return warnings;
}

function updateWarnings() {
    const list = $("warningList");
    const card = $("warningCard");

    if (!list) return;

    const warnings = validateCurrentRecord();

    list.innerHTML = "";

    if (warnings.length === 0) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "問題は見つかっていません";
        list.appendChild(item);

        if (card) card.classList.add("ok");

        return;
    }

    if (card) card.classList.remove("ok");

    warnings.forEach(message => {
        const item = document.createElement("li");
        item.textContent = message;
        list.appendChild(item);
    });
}

function addAdviceItem(list, text, className) {
    const item = document.createElement("li");
    item.textContent = text;

    if (className) item.classList.add(className);

    list.appendChild(item);
}

function updateTodayAdvice() {
    const main = $("todayAdviceMain");
    const list = $("todayAdviceList");

    if (!main || !list) return;

    const date = $("recordDate")?.value || getTodayString();
    const record = getFormData();
    const schedules = getSchedulesForDate(date);
    const tasks = getTasksForDate(date);

    const sleepHours = getNumberOrNull(record.sleepHours);
    const sleepiness = getNumberOrNull(record.sleepiness);
    const fatigue = getNumberOrNull(record.fatigue);
    const focus = getNumberOrNull(record.focus);
    const studyTotal = getNumberOrNull(record.studyTotal);

    const workSchedules = schedules.filter(item => item.category === "勤務");
    const pendingTasks = tasks.filter(item => !item.done);

    let mainText = "今日の状態を入力すると、行動の優先順位を表示します。";
    const adviceItems = [];

    if (workSchedules.length > 0) {
        const hasNight = workSchedules.some(isNightTimeSchedule);

        adviceItems.push({
            text: hasNight
                ? "今日は夜勤務系の予定があります。予定後の睡眠確保を優先してください。"
                : "今日は勤務予定があります。勤務前後に重い予定やタスクを詰めすぎないでください。",
            className: "priority-middle"
        });
    }

    if (schedules.length >= 3) {
        adviceItems.push({
            text: "今日の予定が多めです。タスクは全消化ではなく、重要な1〜2件に絞ってください。",
            className: "priority-middle"
        });
    }

    if (pendingTasks.length >= 4) {
        adviceItems.push({
            text: `未完了タスクが${pendingTasks.length}件あります。全部終わらせる前提ではなく、優先順位をつけてください。`,
            className: "priority-middle"
        });
    }

    if (sleepHours !== null && sleepHours < 5) {
        mainText = "今日は回復優先です。重い予定・タスク・取り組みを増やさないでください。";
        adviceItems.push({
            text: "実睡眠が5時間未満です。予定の変更余地があるなら、回復時間を先に確保してください。",
            className: "priority-high"
        });
    } else if (sleepHours !== null && sleepHours < 6) {
        mainText = "睡眠がやや不足しています。量よりも最低限の継続を優先してください。";
        adviceItems.push({
            text: "実睡眠が6時間未満です。取り組みは5〜15分単位に分ける方が安全です。",
            className: "priority-middle"
        });
    }

    if (fatigue !== null && fatigue >= 8) {
        mainText = "疲労が強い日です。予定を増やさず、タスクは最低限にしてください。";
        adviceItems.push({
            text: "疲労が8以上です。未完了タスクを全部処理しようとしないでください。",
            className: "priority-high"
        });
    }

    if (sleepiness !== null && sleepiness >= 8) {
        adviceItems.push({
            text: "眠気が強いです。仮眠・食事・入浴・室温調整のどれかを入れてください。",
            className: "priority-high"
        });
    }

    if (focus !== null && focus >= 8) {
        const goal = getGoal();
        const target = goal.priorityItem || record.mainSubject || "重要項目";

        adviceItems.push({
            text: `集中力が高めです。「${target}」を進める好機です。`,
            className: "priority-good"
        });
    }

    if (studyTotal !== null && studyTotal >= 180) {
        adviceItems.push({
            text: "取り組み時間は十分です。追加で詰め込むより、睡眠予定を守ることを優先してください。",
            className: "priority-good"
        });
    }

    const achievedHabits = getHabitAchievementCount(date);

    if (achievedHabits > 0) {
        adviceItems.push({
            text: `今日は継続項目を${achievedHabits}件達成しています。小さい習慣は維持できています。`,
            className: "priority-good"
        });
    }

    if (adviceItems.length === 0) {
        adviceItems.push({
            text: "予定・タスク・睡眠・体調のいずれかを入力すると、助言が具体化します。",
            className: "priority-middle"
        });
    }

    main.textContent = mainText;
    list.innerHTML = "";

    adviceItems.slice(0, 6).forEach(item => addAdviceItem(list, item.text, item.className));
}

function updateCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
    updateTodayAdvice();
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
    const bedtimeGaps = [];
    const wakeTimeGaps = [];

    let recordDays = 0;
    let sleepShortDays = 0;
    let studyTotal = 0;
    let studyDays = 0;
    let nightShiftDays = 0;
    let achievementTargetCount = 0;
    let achievedCount = 0;

    const subjectStudyTotals = {};

    dates.forEach(date => {
        const record = records[date];

        if (!record) return;

        recordDays += 1;

        const sleep = getNumberOrNull(record.sleepHours);
        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const focus = getNumberOrNull(record.focus);
        const fatigue = getNumberOrNull(record.fatigue);
        const sleepiness = getNumberOrNull(record.sleepiness);
        const study = getNumberOrNull(record.studyTotal);
        const achievement = calculateAchievementFromRecord(record);

        if (sleep !== null) {
            sleepValues.push(sleep);
            if (sleep < 6) sleepShortDays += 1;
        }

        if (efficiency !== null && efficiency <= 100) efficiencyValues.push(efficiency);
        if (focus !== null) focusValues.push(focus);
        if (fatigue !== null) fatigueValues.push(fatigue);
        if (sleepiness !== null) sleepinessValues.push(sleepiness);

        if (study !== null) {
            studyTotal += study;

            if (study > 0) {
                studyDays += 1;

                const subject = record.mainSubject || "未選択";
                const sub = record.subSubject ? ` / ${record.subSubject}` : "";
                const key = `${subject}${sub}`;

                subjectStudyTotals[key] = (subjectStudyTotals[key] || 0) + study;
            }
        }

        if (isNightShiftWorkType(record.workType)) nightShiftDays += 1;

        if (achievement) {
            if (achievement.bedtimeGap !== null) bedtimeGaps.push(achievement.bedtimeGap);
            if (achievement.wakeTimeGap !== null) wakeTimeGaps.push(achievement.wakeTimeGap);

            if (achievement.canJudgeAchievement) {
                achievementTargetCount += 1;

                if (achievement.achieved) achievedCount += 1;
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
        bedtimeGaps,
        wakeTimeGaps,
        sleepShortDays,
        studyTotal,
        studyDays,
        nightShiftDays,
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

        daySchedules.forEach(schedule => {
            if (schedule.category === "休み") return;

            const hours = getScheduleHours(schedule);

            if (hours !== null) {
                scheduleHours += hours;

                if (schedule.category === "勤務") workHours += hours;
            }

            if (schedule.category === "勤務" && isNightTimeSchedule(schedule)) {
                nightScheduleCount += 1;
            }
        });

        dayTasks.forEach(task => {
            taskTotal += 1;

            if (task.done) taskDone += 1;
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

function updateWeeklySummary() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);

    setText("weeklyAvgSleep", averageText(stats.sleepValues, "時間"));
    setText("weeklyAvgEfficiency", averageText(stats.efficiencyValues, "%"));
    setText("weeklyStudyTotal", stats.studyTotal > 0 ? `${stats.studyTotal}分` : "未計算");
    setText("weeklyAvgFocus", averageText(stats.focusValues, ""));
}

function setGapSummary(id, value) {
    const element = $(id);

    if (!element) return;

    element.classList.remove("good", "warning", "danger");

    if (value === null) {
        element.textContent = "未計算";
        return;
    }

    element.textContent = formatGapMinutes(value);
    setSummaryClass(element, value, "gap");
}

function updateAchievementSummary() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);

    const timeInBedGaps = [];

    dates.forEach(date => {
        const achievement = calculateAchievementFromRecord(records[date]);

        if (achievement && achievement.timeInBedGap !== null) {
            timeInBedGaps.push(achievement.timeInBedGap);
        }
    });

    setGapSummary("weeklyAvgBedtimeGap", averageNumber(stats.bedtimeGaps));
    setGapSummary("weeklyAvgWakeTimeGap", averageNumber(stats.wakeTimeGaps));
    setGapSummary("weeklyAvgTimeInBedGap", averageNumber(timeInBedGaps));

    const element = $("weeklyAchievementRate");

    if (!element) return;

    element.classList.remove("good", "warning", "danger");

    if (stats.achievementRate === null) {
        element.textContent = "未計算";
    } else {
        element.textContent = `${stats.achievementRate.toFixed(0)}%`;
        setSummaryClass(element, stats.achievementRate, "achievement");
    }
}

function getHabitRateForDates(dates) {
    const habits = getHabits();

    if (habits.length === 0 || dates.length === 0) return null;

    let achieved = 0;
    const total = habits.length * dates.length;

    dates.forEach(date => {
        habits.forEach(habit => {
            if (getHabitResult(date, habit.id) === true) achieved += 1;
        });
    });

    return total === 0 ? null : achieved / total * 100;
}

function getWeeklyHabitRate() {
    return getHabitRateForDates(getRecentDates(7));
}

function buildWeeklyCompareText() {
    const records = getRecords();
    const thisWeekDates = getRecentDates(7);
    const lastWeekDates = getRecentDates(14).slice(0, 7);
    const thisWeek = buildPeriodStats(records, thisWeekDates);
    const lastWeek = buildPeriodStats(records, lastWeekDates);

    if (thisWeek.recordDays === 0 && lastWeek.recordDays === 0) return "比較できる記録がまだありません。";
    if (lastWeek.recordDays === 0) return "先週の記録がないため、今週との比較はまだできません。";

    const comments = [];
    const thisSleep = averageNumber(thisWeek.sleepValues);
    const lastSleep = averageNumber(lastWeek.sleepValues);
    const thisFocus = averageNumber(thisWeek.focusValues);
    const lastFocus = averageNumber(lastWeek.focusValues);

    if (thisSleep !== null && lastSleep !== null) {
        const diff = thisSleep - lastSleep;
        comments.push(`睡眠：今週${thisSleep.toFixed(1)}h / 先週${lastSleep.toFixed(1)}h（${diff >= 0 ? "+" : ""}${diff.toFixed(1)}h）`);
    }

    if (thisFocus !== null && lastFocus !== null) {
        const diff = thisFocus - lastFocus;
        comments.push(`集中力：今週${thisFocus.toFixed(1)} / 先週${lastFocus.toFixed(1)}（${diff >= 0 ? "+" : ""}${diff.toFixed(1)}）`);
    }

    if (thisWeek.studyTotal > 0 || lastWeek.studyTotal > 0) {
        const diff = thisWeek.studyTotal - lastWeek.studyTotal;
        comments.push(`取り組み時間：今週${thisWeek.studyTotal}分 / 先週${lastWeek.studyTotal}分（${diff >= 0 ? "+" : ""}${diff}分）`);
    }

    const thisHabitRate = getWeeklyHabitRate();
    const lastHabitRate = getHabitRateForDates(lastWeekDates);

    if (thisHabitRate !== null && lastHabitRate !== null) {
        const diff = thisHabitRate - lastHabitRate;
        comments.push(`習慣達成率：今週${thisHabitRate.toFixed(0)}% / 先週${lastHabitRate.toFixed(0)}%（${diff >= 0 ? "+" : ""}${diff.toFixed(0)}pt）`);
    }

    return comments.length === 0
        ? "先週比較には、睡眠・集中力・取り組み時間・習慣の記録がもう少し必要です。"
        : comments.join("。");
}

function buildSubjectStats(days) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const subjectMap = {};
    let totalMinutes = 0;
    let recordedDays = 0;

    dates.forEach(date => {
        const record = records[date];

        if (!record) return;

        const minutes = getNumberOrNull(record.studyTotal);
        const subject = record.mainSubject || "未選択";

        if (minutes !== null) {
            totalMinutes += minutes;

            if (minutes > 0) {
                recordedDays += 1;
                subjectMap[subject] = (subjectMap[subject] || 0) + minutes;
            }
        }
    });

    const items = Object.entries(subjectMap)
        .map(([subject, minutes]) => ({
            subject,
            minutes,
            percent: totalMinutes > 0 ? minutes / totalMinutes * 100 : 0
        }))
        .sort((a, b) => b.minutes - a.minutes);

    return { days, totalMinutes, recordedDays, items };
}

function buildSubSubjectStats(days) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const subMap = {};
    let totalMinutes = 0;

    dates.forEach(date => {
        const record = records[date];

        if (!record) return;

        const minutes = getNumberOrNull(record.studyTotal);

        if (minutes === null || minutes <= 0) return;

        const parent = record.mainSubject || "未選択";
        const sub = record.subSubject || "子項目未選択";
        const key = `${parent} / ${sub}`;

        totalMinutes += minutes;
        subMap[key] = (subMap[key] || 0) + minutes;
    });

    const items = Object.entries(subMap)
        .map(([subject, minutes]) => ({
            subject,
            minutes,
            percent: totalMinutes > 0 ? minutes / totalMinutes * 100 : 0
        }))
        .sort((a, b) => b.minutes - a.minutes);

    return { days, totalMinutes, items };
}

function buildWeeklyReviewData() {
    const records = getRecords();
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);
    const habitRate = getWeeklyHabitRate();
    const goal = getGoal();
    const planStats = buildPlanStats(dates);

    const good = [];
    const problems = [];
    const nextActions = [];

    const avgSleep = averageNumber(stats.sleepValues);
    const avgFocus = averageNumber(stats.focusValues);
    const avgFatigue = averageNumber(stats.fatigueValues);

    if (stats.recordDays >= 5) good.push(`7日中${stats.recordDays}日記録できています。`);
    else {
        problems.push(`記録日数が${stats.recordDays}/7日です。`);
        nextActions.push("来週は睡眠時間・疲労・継続項目だけでも記録してください。");
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
        nextActions.push("来週は最重要の継続項目を1つ決めて落とさない方針にしてください。");
    }

    if (avgFocus !== null && avgFocus >= 6) good.push(`平均集中力は${avgFocus.toFixed(1)}です。`);
    else if (avgFocus !== null) {
        problems.push(`平均集中力は${avgFocus.toFixed(1)}で低めです。`);
        nextActions.push("来週は新規内容より、復習・整理・短時間着手を増やしてください。");
    }

    if (avgFatigue !== null && avgFatigue >= 7) {
        problems.push(`平均疲労は${avgFatigue.toFixed(1)}で高めです。`);
        nextActions.push("休日や勤務後に回復を先に置く日を作ってください。");
    }

    if (goal.priorityItem) {
        const priority = buildSubjectStats(7).items.find(item => item.subject === goal.priorityItem);

        if (priority && priority.minutes > 0) good.push(`優先項目「${goal.priorityItem}」に${priority.minutes}分触れています。`);
        else {
            problems.push(`優先項目「${goal.priorityItem}」に直近7日で触れられていません。`);
            nextActions.push(`来週は「${goal.priorityItem}」を5分だけでも入れてください。`);
        }
    }

    if (planStats.taskTotal > 0 && planStats.taskDoneRate >= 70) {
        good.push(`タスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`);
    } else if (planStats.taskTotal > 0) {
        problems.push(`タスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`);
        nextActions.push("来週はタスクを入れすぎず、1日1〜3件に絞ってください。");
    }

    if (planStats.scheduleHours >= 50) {
        problems.push(`直近7日の予定時間が${planStats.scheduleHours.toFixed(1)}時間あり、予定過多気味です。`);
        nextActions.push("来週は予定の空白時間を意図的に残してください。");
    }

    if (good.length === 0) good.push("まだ良かった点を判定できるほど記録がありません。");
    if (problems.length === 0) problems.push("大きな崩れは検出されていません。");
    if (nextActions.length === 0) nextActions.push("来週は現在のリズムを維持し、優先項目に少しずつ時間を寄せてください。");

    let conclusion = "今週の記録から、来週の方針を整理します。";

    if (problems.length >= 4) {
        conclusion = "今週は崩れ要因が複数あります。来週は成果拡大より、睡眠・予定圧縮・最低限の継続を優先してください。";
    } else if (good.length >= 4 && problems.length <= 1) {
        conclusion = "今週は比較的安定しています。来週は優先項目に少し負荷を足せます。";
    } else {
        conclusion = "今週は良い点と崩れた点が混在しています。来週は最低ラインを小さく固定してください。";
    }

    return {
        conclusion,
        good,
        problems,
        nextActions,
        recordDays: stats.recordDays,
        habitRate,
        studyDays: stats.studyDays
    };
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
    setText("weeklyReviewStudyDays", `${data.studyDays}日`);

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

    if (stats.scheduleHours === 0 && stats.taskTotal === 0) {
        comment.textContent = "予定・タスクの記録がまだありません。勤務や学習予定を入れると、生活負荷を分析できます。";
        return;
    }

    if (stats.workHours >= 40) {
        comment.textContent = `直近7日の勤務時間が${stats.workHours.toFixed(1)}時間です。睡眠・疲労・取り組み時間への影響を強く受ける可能性があります。`;
        return;
    }

    if (stats.scheduleHours >= 50) {
        comment.textContent = `直近7日の予定時間が${stats.scheduleHours.toFixed(1)}時間です。空白時間が不足すると疲労が抜けにくくなります。`;
        return;
    }

    if (stats.taskTotal > 0 && stats.taskDoneRate < 50) {
        comment.textContent = `タスク完了率が${stats.taskDoneRate.toFixed(0)}%です。タスク数を減らし、重要なものだけに絞る方がよいです。`;
        return;
    }

    if (stats.nightScheduleCount >= 1) {
        comment.textContent = `夜勤務系予定が${stats.nightScheduleCount}件あります。勤務前後の睡眠と予定詰め込みに注意してください。`;
        return;
    }

    comment.textContent = "予定・タスクの負荷は過大ではありません。優先項目に時間を配分できているか確認してください。";
}

function renderSubjectAnalysisList(containerId, stats) {
    const container = $(containerId);

    if (!container) return;

    container.innerHTML = "";

    if (stats.items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "取り組み時間の記録がありません。";
        container.appendChild(empty);
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
            <span class="subject-analysis-time">${item.minutes}分</span>
        `;

        container.appendChild(row);
    });
}

function updateSubjectAnalysis() {
    const stats7 = buildSubjectStats(7);
    const stats30 = buildSubjectStats(30);
    const goal = getGoal();

    const top7 = stats7.items[0];
    const top30 = stats30.items[0];

    setText("topSubject7", top7 ? top7.subject : "未計算");
    setText("topSubject30", top30 ? top30.subject : "未計算");

    renderSubjectAnalysisList("subjectAnalysis7", stats7);
    renderSubjectAnalysisList("subjectAnalysis30", stats30);

    const comment = $("subjectAnalysisComment");

    if (!comment) return;

    if (stats7.items.length === 0) {
        comment.textContent = "まだ項目別に分析できる記録がありません。";
        return;
    }

    if (goal.priorityItem) {
        const priority7 = stats7.items.find(item => item.subject === goal.priorityItem);

        if (!priority7 || priority7.minutes === 0) {
            comment.textContent = `優先項目「${goal.priorityItem}」が直近7日で未着手です。5〜15分だけでも触れる日を作るとよいです。`;
            return;
        }
    }

    if (top7 && top7.percent >= 70) {
        comment.textContent = `直近7日は「${top7.subject}」に偏っています。意図した偏りか確認してください。`;
        return;
    }

    comment.textContent = "親項目別の取り組みは大きな偏りが少ない状態です。";
}

function updateSubSubjectAnalysis() {
    const stats7 = buildSubSubjectStats(7);
    const stats30 = buildSubSubjectStats(30);
    const top7 = stats7.items[0];
    const top30 = stats30.items[0];

    setText("topSubSubject7", top7 ? top7.subject : "未計算");
    setText("topSubSubject30", top30 ? top30.subject : "未計算");

    renderSubjectAnalysisList("subSubjectAnalysis7", stats7);
    renderSubjectAnalysisList("subSubjectAnalysis30", stats30);

    const comment = $("subSubjectAnalysisComment");

    if (!comment) return;

    if (stats7.items.length === 0) {
        comment.textContent = "まだ子項目・教材別に分析できる記録がありません。";
        return;
    }

    if (top7 && top7.percent >= 70) {
        comment.textContent = `直近7日は「${top7.subject}」に集中しています。他の教材が止まっていないか確認してください。`;
        return;
    }

    comment.textContent = "子項目・教材別の偏りは大きすぎません。";
}

function updateHabitAnalysis() {
    const list = $("habitAnalysisList");
    const comment = $("habitAnalysisComment");

    if (!list) return;

    const habits = getHabits();
    const date = $("recordDate")?.value || getTodayString();

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目はまだありません。設定ページで追加してください。";
        list.appendChild(empty);

        if (comment) comment.textContent = "継続項目が追加されると、達成率や継続日数を表示します。";

        return;
    }

    let bestHabit = null;
    let bestStreak = 0;

    habits.forEach(habit => {
        const streak = getHabitStreakUntil(date, habit.id);
        const rate7 = getHabitAchievementRate(habit.id, 7);
        const rate30 = getHabitAchievementRate(habit.id, 30);

        if (streak > bestStreak) {
            bestStreak = streak;
            bestHabit = habit;
        }

        const item = document.createElement("div");
        item.className = "habit-analysis-item";

        item.innerHTML = `
            <p class="habit-analysis-title">${escapeHtml(habit.name)}</p>
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
                    <span class="habit-metric-label">直近30日達成率</span>
                    <span class="habit-metric-value">${rate30.rate.toFixed(0)}%</span>
                </div>
            </div>
            <p class="habit-effect-text">習慣と体調の比較分析は、達成日・未達成日の記録が増えるほど安定します。</p>
        `;

        list.appendChild(item);
    });

    if (comment) {
        if (bestHabit && bestStreak > 0) {
            comment.textContent = `最も続いているのは「${bestHabit.name}」で、現在${bestStreak}日継続中です。`;
        } else {
            comment.textContent = "まだ継続中の項目はありません。まずは1つだけ実行してください。";
        }
    }
}

// ==============================
// 自動検知・相関
// ==============================

function makeAlert(level, title, message, action, priority) {
    return { level, title, message, action, priority };
}

function detectAutoAlerts() {
    const alerts = [];
    const date = $("recordDate")?.value || getTodayString();
    const record = getFormData();
    const planStats = buildPlanStats(getRecentDates(7));

    const sleep = getNumberOrNull(record.sleepHours);
    const fatigue = getNumberOrNull(record.fatigue);
    const sleepiness = getNumberOrNull(record.sleepiness);
    const focus = getNumberOrNull(record.focus);
    const study = getNumberOrNull(record.studyTotal);

    if (sleep !== null && sleep < 5) {
        alerts.push(makeAlert("high", "今日の実睡眠が5時間未満です", `今日の実睡眠は${sleep.toFixed(1)}時間です。`, "重い予定・タスク・取り組みを抑え、回復を優先してください。", 100));
    }

    if (fatigue !== null && fatigue >= 8) {
        alerts.push(makeAlert("high", "今日の疲労が強いです", `疲労は${fatigue}/10です。`, "最低限のタスクだけに絞ってください。", 95));
    }

    if (sleepiness !== null && sleepiness >= 8) {
        alerts.push(makeAlert("high", "今日の眠気が強いです", `眠気は${sleepiness}/10です。`, "仮眠・食事・入浴・室温調整のどれかを入れてください。", 94));
    }

    if (planStats.scheduleHours >= 50) {
        alerts.push(makeAlert("medium", "直近7日の予定時間が多めです", `予定時間は${planStats.scheduleHours.toFixed(1)}時間です。`, "空白時間を残し、睡眠を削らない予定にしてください。", 80));
    }

    if (planStats.workHours >= 35) {
        alerts.push(makeAlert("medium", "勤務時間が多めです", `直近7日の勤務時間は${planStats.workHours.toFixed(1)}時間です。`, "勤務前後の回復時間を先に確保してください。", 78));
    }

    if (planStats.taskTotal > 0 && planStats.taskDoneRate < 50) {
        alerts.push(makeAlert("medium", "タスク完了率が低めです", `直近7日のタスク完了率は${planStats.taskDoneRate.toFixed(0)}%です。`, "タスクを減らし、重要な1〜3件に絞ってください。", 70));
    }

    if (focus !== null && focus >= 7 && study !== null && study === 0) {
        alerts.push(makeAlert("medium", "集中力があるのに取り組み0分です", "状態は悪くないのに着手できていない可能性があります。", "5〜15分だけでも優先項目に触れてください。", 65));
    }

    if (getHabits().length > 0 && getHabitAchievementCount(date) === 0) {
        alerts.push(makeAlert("medium", "今日は継続項目が未達成です", "小さい習慣がまだ記録されていません。", "1つだけでも記録してください。", 60));
    }

    const records = getRecords();
    const stats = buildPeriodStats(records, getRecentDates(7));
    const avgSleep = averageNumber(stats.sleepValues);

    if (avgSleep !== null && avgSleep >= 6.5 && planStats.taskTotal > 0 && planStats.taskDoneRate >= 70) {
        alerts.push(makeAlert("good", "睡眠とタスク処理が安定しています", "睡眠と行動のバランスは比較的良好です。", "この状態を維持し、優先項目に少し時間を寄せてください。", 25));
    }

    if (stats.studyDays >= 5) {
        alerts.push(makeAlert("good", "取り組みの継続はできています", `直近7日のうち${stats.studyDays}日で取り組み記録があります。`, "項目配分を確認してください。", 20));
    }

    if (alerts.length === 0) {
        alerts.push(makeAlert("good", "大きな警戒サインは見つかっていません", "現時点で強い崩れは検出されていません。", "記録を続けると分析精度が上がります。", 10));
    }

    return alerts.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

function getAutoAlertConclusion(alerts) {
    const high = alerts.filter(alert => alert.level === "high").length;
    const medium = alerts.filter(alert => alert.level === "medium").length;

    if (high >= 2) return "今日は回復優先です。予定・タスク・取り組み量を増やさないでください。";
    if (high === 1) return "今日は慎重運用です。最低限の継続と回復を優先してください。";
    if (medium >= 3) return "生活リズムに注意点があります。予定とタスクを詰めすぎない方が安全です。";
    if (medium >= 1) return "軽い注意点があります。睡眠予定とタスク量を確認してください。";

    return "大きな警戒サインはありません。状態が良い時間に優先項目を進める余地があります。";
}

function renderAlertItem(alert) {
    const item = document.createElement("div");
    item.className = `alert-item ${alert.level}`;

    const levelText = alert.level === "high" ? "警戒" : alert.level === "medium" ? "注意" : "良好";

    item.innerHTML = `
        <span class="alert-level ${alert.level}">${levelText}</span>
        <p class="alert-title">${escapeHtml(alert.title)}</p>
        <p class="alert-message">${escapeHtml(alert.message)}</p>
        <p class="alert-action">${escapeHtml(alert.action)}</p>
    `;

    return item;
}

function updateAutoAlerts() {
    const list = $("autoAlertList");

    if (!list) return;

    const alerts = detectAutoAlerts();
    const high = alerts.filter(alert => alert.level === "high").length;
    const medium = alerts.filter(alert => alert.level === "medium").length;
    const good = alerts.filter(alert => alert.level === "good").length;

    if ($("alertHighCount")) {
        $("alertHighCount").textContent = `${high}件`;
        $("alertHighCount").className = high > 0 ? "summary-value danger" : "summary-value";
    }

    if ($("alertMediumCount")) {
        $("alertMediumCount").textContent = `${medium}件`;
        $("alertMediumCount").className = medium > 0 ? "summary-value warning" : "summary-value";
    }

    if ($("alertGoodCount")) {
        $("alertGoodCount").textContent = `${good}件`;
        $("alertGoodCount").className = good > 0 ? "summary-value good" : "summary-value";
    }

    setText("autoAlertConclusion", getAutoAlertConclusion(alerts));

    list.innerHTML = "";
    alerts.forEach(alert => list.appendChild(renderAlertItem(alert)));
}

function renderSimpleFactor(containerId, lines) {
    const container = $(containerId);

    if (!container) return;

    container.innerHTML = "";

    lines.forEach(line => {
        const item = document.createElement("div");
        item.className = "factor-item";

        item.innerHTML = `
            <div>
                <span class="factor-name">${escapeHtml(line)}</span>
                <span class="factor-detail">v9.0簡易分析</span>
            </div>
            <span class="factor-score">確認</span>
        `;

        container.appendChild(item);
    });
}

function updateCorrelationAnalysis() {
    const records = getRecords();
    const range = $("correlationRange")?.value === "all" ? 3650 : 30;
    const dates = getRecentDates(range);
    const stats = buildPeriodStats(records, dates);
    const planStats = buildPlanStats(dates);

    setText("correlationValidCount", `${stats.recordDays}日`);
    setText("correlationTopStrength", "簡易");

    setText(
        "correlationInsight",
        "v9.0では、予定・タスク・勤務時間も分析対象に入れています。まずは予定過多・勤務時間・タスク完了率と睡眠・疲労・集中力の関係を確認します。"
    );

    renderSimpleFactor("studyFactorRanking", [
        `取り組み日数：${stats.studyDays}日`,
        `予定時間：${planStats.scheduleHours.toFixed(1)}h`,
        `タスク完了率：${planStats.taskDoneRate === null ? "未計算" : planStats.taskDoneRate.toFixed(0) + "%"}`
    ]);

    renderSimpleFactor("focusFactorRanking", [
        `平均集中力：${averageText(stats.focusValues, "")}`,
        `平均睡眠：${averageText(stats.sleepValues, "時間")}`,
        `夜勤務系予定：${planStats.nightScheduleCount}件`
    ]);

    renderSimpleFactor("riskFactorRanking", [
        `勤務時間：${planStats.workHours.toFixed(1)}h`,
        `平均疲労：${averageText(stats.fatigueValues, "")}`,
        `平均眠気：${averageText(stats.sleepinessValues, "")}`
    ]);

    const list = $("correlationList");

    if (!list) return;

    list.innerHTML = "";

    const item = document.createElement("div");
    item.className = "correlation-item middle";

    item.innerHTML = `
        <span class="correlation-level middle">確認候補</span>
        <p class="correlation-title">予定・タスク負荷 × 睡眠・疲労・集中力</p>
        <p class="correlation-message">直近の予定時間、勤務時間、タスク完了率を、睡眠・疲労・集中力と一緒に確認してください。</p>
        <p class="correlation-note-text">予定時間${planStats.scheduleHours.toFixed(1)}h / 勤務時間${planStats.workHours.toFixed(1)}h / タスク完了率${planStats.taskDoneRate === null ? "未計算" : planStats.taskDoneRate.toFixed(0) + "%"}</p>
        <p class="correlation-warning">相関は原因を証明するものではありません。記録が増えたら厳密な相関計算を追加できます。</p>
    `;

    list.appendChild(item);
}

// ==============================
// カレンダー・履歴
// ==============================

function getRecordCompleteness(record, date) {
    const hasSchedule = date ? getSchedulesForDate(date).length > 0 : false;
    const hasTask = date ? getTasksForDate(date).length > 0 : false;
    const hasHabit = date ? getHabitAchievementCount(date) > 0 : false;

    if (!record) {
        if (hasSchedule || hasTask || hasHabit) return "partial";
        return "none";
    }

    const hasActualSleep = Boolean(record.bedtime || record.wakeTime || record.sleepHours || record.awakeCount);
    const hasCondition = Boolean(record.mood || record.sleepiness || record.fatigue || record.focus);
    const hasStudy = Boolean(record.studyTotal || record.mainSubject || record.subSubject);
    const hasWork = Boolean(record.workType);
    const hasMemo = Boolean(record.memo && record.memo.trim() !== "");

    const count = [hasActualSleep, hasCondition, hasStudy, hasWork, hasMemo, hasHabit, hasSchedule, hasTask].filter(Boolean).length;

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
        button.title = `${date}：${getCompletenessLabel(completeness)}`;

        if (date === today) button.classList.add("today");
        if (date === currentDate) button.classList.add("selected");

        button.innerHTML = `
            <span class="calendar-day-number">${formatShortDate(date)}</span>
            <span class="calendar-day-label">${getCompletenessLabel(completeness)}</span>
        `;

        button.addEventListener("click", () => {
            if ($("recordDate")) $("recordDate").value = date;
            loadRecord(date);
            showPage("todayPage");
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
    const historyList = $("historyList");

    if (!historyList) return;

    const records = getRecords();
    const scheduleDates = Object.keys(getSchedules());
    const taskDates = Object.keys(getTasks());
    const allDates = [...new Set([...Object.keys(records), ...scheduleDates, ...taskDates])].sort().reverse();
    const dates = filterDates(allDates);

    historyList.innerHTML = "";

    if (dates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "この期間の記録はありません";
        historyList.appendChild(empty);
        return;
    }

    dates.forEach(date => {
        const record = records[date] || {};
        const schedules = getSchedulesForDate(date);
        const tasks = getTasksForDate(date);
        const completeness = getRecordCompleteness(records[date], date);
        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const achievement = calculateAchievementFromRecord(record);
        const habitCount = getHabitAchievementCount(date);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `history-item ${completeness}`;

        if (date === currentDate) button.classList.add("active");

        const sleepText = record.sleepHours ? `実睡眠 ${record.sleepHours}h` : "実睡眠 未入力";
        const efficiencyText = efficiency !== null ? `効率 ${efficiency.toFixed(1)}%` : "効率 未計算";
        const studyText = record.studyTotal ? `取り組み ${record.studyTotal}分` : "取り組み 未入力";
        const subjectText = record.mainSubject ? `項目 ${record.mainSubject}${record.subSubject ? " / " + record.subSubject : ""}` : "項目 未入力";
        const workText = record.workType ? `勤務・予定 ${record.workType}` : "勤務・予定 未入力";
        const achievementText = achievement && achievement.canJudgeAchievement ? achievement.achieved ? "予定達成" : "予定未達" : "予定判定 未計算";

        button.innerHTML = `
            <span class="history-date">${date}　${getCompletenessLabel(completeness)}記録</span>
            <span class="history-detail">${sleepText}　${efficiencyText}</span>
            <span class="history-detail">${studyText}　${subjectText}　${workText}</span>
            <span class="history-detail">予定${schedules.length}件　タスク${tasks.length}件　習慣達成${habitCount}件　${achievementText}</span>
        `;

        button.addEventListener("click", () => {
            if ($("recordDate")) $("recordDate").value = date;
            loadRecord(date);
            showPage("todayPage");
        });

        historyList.appendChild(button);
    });
}

// ==============================
// グラフ
// ==============================

function getChartDates() {
    const range = $("chartRange")?.value || "30";

    if (range === "all") {
        return Object.keys(getRecords()).sort();
    }

    return getRecentDates(Number(range));
}

function buildChartLabels(dates) {
    return dates.map(date => dates.length > 40 ? date.slice(5) : formatShortDate(date));
}

function buildSeriesFromRecords(dates, key) {
    const records = getRecords();

    return dates.map(date => {
        const record = records[date];

        if (!record) return null;

        return getNumberOrNull(record[key]);
    });
}

function buildGapSeries(dates, type) {
    const records = getRecords();

    return dates.map(date => {
        const record = records[date];

        if (!record) return null;

        const achievement = calculateAchievementFromRecord(record);

        if (!achievement) return null;

        return type === "bedtime" ? achievement.bedtimeGap : achievement.wakeTimeGap;
    });
}

function resizeCanvasForDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(rect.width);
    const displayHeight = Math.floor(displayWidth * 0.4);

    canvas.width = displayWidth * ratio;
    canvas.height = displayHeight * ratio;

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

    datasets.forEach(dataset => {
        dataset.values.forEach(value => {
            if (value !== null && value !== undefined && !Number.isNaN(value)) values.push(value);
        });
    });

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

    function xForIndex(index) {
        if (labels.length === 1) return padding.left + chartWidth / 2;
        return padding.left + chartWidth * index / (labels.length - 1);
    }

    function yForValue(value) {
        return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
    }

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

    datasets.forEach(dataset => {
        const isActive = config.activeKey && dataset.key === config.activeKey;
        const isInactive = config.activeKey && dataset.key !== config.activeKey;

        ctx.strokeStyle = dataset.color;
        ctx.fillStyle = dataset.color;
        ctx.lineWidth = isActive ? 4 : isInactive ? 1.5 : 2;
        ctx.globalAlpha = isInactive ? 0.22 : 1;

        let drawing = false;

        dataset.values.forEach((value, index) => {
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

        dataset.values.forEach((value, index) => {
            if (value === null || value === undefined || Number.isNaN(value)) return;

            ctx.beginPath();
            ctx.arc(xForIndex(index), yForValue(value), isActive ? 5 : 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    });
}

function updateConditionChartButtons() {
    const buttons = document.querySelectorAll(".condition-chart-button");
    const status = $("conditionChartFocusStatus");

    buttons.forEach(button => {
        button.classList.toggle("active", button.dataset.conditionKey === activeConditionChartKey);
    });

    if (status) {
        const labels = {
            mood: "気分",
            sleepiness: "眠気",
            fatigue: "疲労",
            focus: "集中力"
        };

        status.textContent = activeConditionChartKey
            ? `現在の強調：${labels[activeConditionChartKey] || activeConditionChartKey}`
            : "現在の強調：なし（全項目表示）";
    }
}

function updateCharts() {
    const dates = getChartDates();

    if (!dates || dates.length === 0) {
        drawEmptyChart("sleepChart", "記録がありません");
        drawEmptyChart("studyChart", "記録がありません");
        drawEmptyChart("conditionChart", "記録がありません");
        drawEmptyChart("gapChart", "記録がありません");
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
            { key: "sleepHours", label: "実睡眠", color: "#2563eb", values: buildSeriesFromRecords(dates, "sleepHours") }
        ]
    });

    drawLineChart({
        canvasId: "studyChart",
        labels,
        minValue: 0,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            { key: "studyTotal", label: "取り組み時間", color: "#16a34a", values: buildSeriesFromRecords(dates, "studyTotal") }
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
            { key: "mood", label: "気分", color: "#db2777", values: buildSeriesFromRecords(dates, "mood") },
            { key: "sleepiness", label: "眠気", color: "#f59e0b", values: buildSeriesFromRecords(dates, "sleepiness") },
            { key: "fatigue", label: "疲労", color: "#dc2626", values: buildSeriesFromRecords(dates, "fatigue") },
            { key: "focus", label: "集中力", color: "#7c3aed", values: buildSeriesFromRecords(dates, "focus") }
        ]
    });

    drawLineChart({
        canvasId: "gapChart",
        labels,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            { key: "bedtimeGap", label: "就寝ズレ", color: "#0f766e", values: buildGapSeries(dates, "bedtime") },
            { key: "wakeTimeGap", label: "起床ズレ", color: "#ea580c", values: buildGapSeries(dates, "wake") }
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
        const buttons = document.querySelectorAll(`.rating-button[data-target="${field.id}"]`);
        const value = input ? input.value : "";

        if (display) display.textContent = value ? `${value} / 10` : "未入力";

        buttons.forEach(button => {
            button.classList.toggle("selected", button.dataset.value === value);
        });
    });
}

// ==============================
// AI相談
// ==============================

function buildGoalText() {
    const goal = getGoal();

    return [
        "【現在の目標】",
        `目標：${valueOrDash(goal.title)}`,
        `理由：${valueOrDash(goal.reason)}`,
        `最優先項目：${valueOrDash(goal.priorityItem)}`,
        `1日の最低ライン：${valueOrDash(goal.minimumMinutes)}分`,
        `1日の標準ライン：${valueOrDash(goal.standardMinutes)}分`
    ].join("\n");
}

function buildCurrentDayText(date, record) {
    const schedules = getSchedulesForDate(date);
    const tasks = getTasksForDate(date);
    const efficiency = calculateSleepEfficiencyFromRecord(record);
    const achievement = calculateAchievementFromRecord(record);

    return [
        "【現在選択中の日付】",
        `日付：${date}`,
        "",
        "【今日の予定】",
        schedules.length === 0 ? "予定なし" : schedules.map(scheduleLineText).join("\n"),
        "",
        "【今日のタスク】",
        tasks.length === 0
            ? "タスクなし"
            : tasks.map(task => `${task.done ? "済" : "未"}：${task.category} ${task.title}${task.memo ? " / " + task.memo : ""}`).join("\n"),
        "",
        "【睡眠】",
        `予定就寝：${valueOrDash(record.plannedBedtime)}`,
        `予定起床：${formatTimeWithNextDay(record.plannedBedtime, record.plannedWakeTime)}`,
        `実際就寝：${valueOrDash(record.bedtime)}`,
        `実際起床：${formatTimeWithNextDay(record.bedtime, record.wakeTime)}`,
        `実睡眠時間：${valueOrDash(record.sleepHours)}時間`,
        `覚醒回数：${valueOrDash(record.awakeCount)}`,
        `睡眠効率：${efficiency === null ? "未計算" : efficiency.toFixed(1) + "%"}`,
        `就寝ズレ：${achievement ? formatGapMinutes(achievement.bedtimeGap) : "未計算"}`,
        `起床ズレ：${achievement ? formatGapMinutes(achievement.wakeTimeGap) : "未計算"}`,
        "",
        "【体調】",
        `気分：${valueOrDash(record.mood)} / 10`,
        `眠気：${valueOrDash(record.sleepiness)} / 10`,
        `疲労：${valueOrDash(record.fatigue)} / 10`,
        `集中力：${valueOrDash(record.focus)} / 10`,
        "",
        "【行動・取り組み】",
        `取り組み時間：${valueOrDash(record.studyTotal)}分`,
        `親項目：${valueOrDash(record.mainSubject)}`,
        `子項目・教材名：${valueOrDash(record.subSubject)}`,
        `勤務・予定区分：${valueOrDash(record.workType)}`,
        "",
        "【継続項目】",
        getHabits().map(habit => {
            const result = getHabitResult(date, habit.id);
            const resultText = result === true ? "達成" : result === false ? "未達成・途切れた" : "未記録";

            return `${habit.name}：${resultText}`;
        }).join("\n") || "継続項目なし",
        "",
        "【メモ】",
        valueOrDash(record.memo)
    ].join("\n");
}

function buildPeriodSummaryText(title, dates, stats) {
    const firstDate = dates[0] || "不明";
    const lastDate = dates[dates.length - 1] || "不明";
    const planStats = buildPlanStats(dates);

    return [
        `【${title}】`,
        `対象期間：${firstDate} 〜 ${lastDate}`,
        `記録日数：${stats.recordDays}/${stats.targetDays}日`,
        `平均実睡眠：${averageText(stats.sleepValues, "時間")}`,
        `平均睡眠効率：${averageText(stats.efficiencyValues, "%")}`,
        `平均集中力：${averageText(stats.focusValues, "")}`,
        `平均疲労：${averageText(stats.fatigueValues, "")}`,
        `平均眠気：${averageText(stats.sleepinessValues, "")}`,
        `合計取り組み時間：${stats.studyTotal}分`,
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
        `取り組み日数：${data.studyDays}日`,
        "",
        "良かった点：",
        ...data.good.map(item => `・${item}`),
        "",
        "崩れた点：",
        ...data.problems.map(item => `・${item}`),
        "",
        "来週の方針：",
        ...data.nextActions.map(item => `・${item}`)
    ].join("\n");
}

function buildSubjectSummaryText(days) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const stats = buildPeriodStats(records, dates);
    const entries = Object.entries(stats.subjectStudyTotals)
        .filter(([, minutes]) => minutes > 0)
        .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
        return `【直近${days}日の項目別取り組み時間】\n取り組み時間の記録がありません。`;
    }

    return [
        `【直近${days}日の項目別取り組み時間】`,
        ...entries.map(([subject, minutes]) => `${subject}：${minutes}分（${(minutes / 60).toFixed(1)}時間）`)
    ].join("\n");
}

function buildPlanSummaryText(days) {
    const dates = getRecentDates(days);
    const stats = buildPlanStats(dates);

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

function buildAutoAlertsText() {
    const alerts = detectAutoAlerts();

    return [
        "【自動検知】",
        `今日の結論：${getAutoAlertConclusion(alerts)}`,
        ...alerts.map(alert => {
            const level = alert.level === "high" ? "警戒" : alert.level === "medium" ? "注意" : "良好";

            return `・${level}：${alert.title}\n  ${alert.message}\n  対応：${alert.action}`;
        })
    ].join("\n");
}

function buildRecentDailyLines() {
    const records = getRecords();
    const dates = getRecentDates(7);

    return [
        "【直近7日の各日データ】",
        ...dates.map(date => {
            const record = records[date];

            if (!record) {
                const schedules = getSchedulesForDate(date);
                const tasks = getTasksForDate(date);

                if (schedules.length === 0 && tasks.length === 0) return `${date}：記録なし`;

                return `${date}：日次記録なし、予定${schedules.length}件、タスク${tasks.length}件`;
            }

            return `${date}：睡眠${valueOrDash(record.sleepHours)}h、気分${valueOrDash(record.mood)}、眠気${valueOrDash(record.sleepiness)}、疲労${valueOrDash(record.fatigue)}、集中${valueOrDash(record.focus)}、取り組み${valueOrDash(record.studyTotal)}分、項目${valueOrDash(record.mainSubject)}${record.subSubject ? " / " + record.subSubject : ""}、予定${getSchedulesForDate(date).length}件、タスク${getTasksForDate(date).length}件、習慣達成${getHabitAchievementCount(date)}件`;
        })
    ].join("\n");
}

function buildAiText(type, date, record) {
    const records = getRecords();

    const common = [
        "以下は、Life Growth Analyzerから出力した生活記録データです。",
        "睡眠、体調、予定、タスク、仕事、学習、継続習慣を両立しながら、現在の目標に近づきたいです。",
        "極端な根性論ではなく、現実的に継続できる提案をしてください。",
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
            "2. 来週の最低ラインを現実的に設定してほしい。",
            "3. 予定・タスク・勤務・睡眠・学習のどれを最優先で直すべきか。",
            "4. 来週の行動を、最低ライン・標準ライン・余力がある日の3段階で提案してほしい。"
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
            "2. 睡眠・疲労・予定・タスク・取り組み・習慣のどこを優先的に直すべきか。",
            "3. 現在の目標に対して、予定と学習配分は妥当か。",
            "4. タスクを抱えすぎずに進めるにはどうすべきか。"
        ].join("\n");
    }

    if (type === "long") {
        return [
            ...common,
            "",
            buildPeriodSummaryText("直近30日の要約", getRecentDates(30), buildPeriodStats(records, getRecentDates(30))),
            "",
            buildPlanSummaryText(30),
            "",
            "【相談したいこと】",
            "1. 長期的に最も足を引っ張っている要因は何か。",
            "2. 予定・勤務・タスク・睡眠の関係で改善すべき点は何か。",
            "3. 今後1か月で最優先に改善すべき行動は何か。"
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
            "2. 勤務・予定・タスクを踏まえた現実的な学習計画を作ってほしい。",
            "3. 睡眠と体調を崩さずに優先項目へ触れる設計を提案してほしい。"
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
        "3. 勤務・予定の前後に何を優先すべきか。",
        "4. 明日以降に崩れないための注意点は何か。"
    ].join("\n");
}

function getSelectedConsultType() {
    const selected = document.querySelector('input[name="consultType"]:checked');

    return selected ? selected.value : "today";
}

function getConsultTypeLabel(type) {
    if (type === "weekly") return "週間レビュー相談";
    if (type === "thirty") return "直近30日の生活改善相談";
    if (type === "long") return "長期傾向分析";
    if (type === "goal") return "目標達成・学習計画相談";

    return "今日の行動相談";
}

function generateAiConsultText() {
    saveCurrentRecord();

    const records = getRecords();
    const date = $("recordDate")?.value || getTodayString();
    const record = records[date] || getFormData();
    const type = getSelectedConsultType();

    if ($("aiConsultText")) {
        $("aiConsultText").value = buildAiText(type, date, record);
    }

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
// 設定・目標
// ==============================

function loadSettingsToForm() {
    const settings = getSettings();

    if ($("defaultPlannedBedtime")) $("defaultPlannedBedtime").value = settings.defaultPlannedBedtime;
    if ($("defaultPlannedWakeTime")) $("defaultPlannedWakeTime").value = settings.defaultPlannedWakeTime;

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
    updateSetupChecklist();
    alert("基本睡眠予定を保存しました。");
}

function updateSettingsStatus() {
    const settings = getSettings();

    if (!$("settingsStatus")) return;

    if (settings.defaultPlannedBedtime && settings.defaultPlannedWakeTime) {
        $("settingsStatus").textContent = `設定中：${settings.defaultPlannedBedtime} 〜 ${settings.defaultPlannedWakeTime}`;
    } else {
        $("settingsStatus").textContent = "未設定";
    }
}

function loadGoalToForm() {
    const goal = getGoal();

    if ($("goalTitle")) $("goalTitle").value = goal.title;
    if ($("goalReason")) $("goalReason").value = goal.reason;

    updateGoalPriorityOptions(goal.priorityItem);

    if ($("goalMinimumMinutes")) $("goalMinimumMinutes").value = goal.minimumMinutes;
    if ($("goalStandardMinutes")) $("goalStandardMinutes").value = goal.standardMinutes;

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
    updateSetupChecklist();
    updateSaveStatus("目標設定を保存しました", false);
    alert("目標設定を保存しました。");
}

function updateGoalStatus() {
    const status = $("goalStatus");

    if (!status) return;

    const goal = getGoal();

    if (!goal.title) {
        status.textContent = "未設定";
        return;
    }

    const priority = goal.priorityItem ? ` / 優先項目：${goal.priorityItem}` : "";
    const minimum = goal.minimumMinutes ? ` / 最低${goal.minimumMinutes}分` : "";
    const standard = goal.standardMinutes ? ` / 標準${goal.standardMinutes}分` : "";

    status.textContent = `設定中：${goal.title}${priority}${minimum}${standard}`;
}

// ==============================
// 初回セットアップ
// ==============================

function buildSetupItems() {
    const goal = getGoal();
    const subjects = getSubjectConfigs();
    const habits = getHabits();
    const templates = getScheduleTemplates();

    return [
        {
            label: "目標を設定する",
            done: Boolean(goal.title || goal.reason || goal.priorityItem || goal.minimumMinutes || goal.standardMinutes)
        },
        {
            label: "取り組み項目を追加する",
            done: subjects.length > 0
        },
        {
            label: "継続項目を追加する",
            done: habits.length > 0
        },
        {
            label: "予定テンプレートを追加する",
            done: templates.length > 0
        }
    ];
}

function renderSetupChecklist(containerId) {
    const container = $(containerId);

    if (!container) return;

    const items = buildSetupItems();

    container.innerHTML = "";

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = `setup-item ${item.done ? "done" : ""}`;

        row.innerHTML = `
            <span class="setup-mark">${item.done ? "✓" : "□"}</span>
            <span>${escapeHtml(item.label)}</span>
        `;

        container.appendChild(row);
    });
}

function updateSetupChecklist() {
    renderSetupChecklist("setupChecklist");
    renderSetupChecklist("settingsSetupChecklist");

    const card = $("initialSetupCard");

    if (!card) return;

    const allDone = buildSetupItems().every(item => item.done);

    card.style.display = allDone ? "none" : "";
}

// ==============================
// 削除・バックアップ
// ==============================

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

    updateCalculatedDisplays();
    updateSaveStatus(`削除しました：${date}`, false);
    updateAllDisplays();
}

function exportData() {
    const backupData = {
        appName: "Life Growth Analyzer",
        version: "9.0",
        exportedAt: new Date().toISOString(),
        settings: getSettings(),
        subjects: getSubjectConfigs(),
        goal: getGoal(),
        habits: getHabits(),
        habitRecords: getHabitRecords(),
        schedules: getSchedules(),
        tasks: getTasks(),
        scheduleTemplates: getScheduleTemplates(),
        records: getRecords()
    };

    const jsonText = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const fileName = `life-growth-analyzer-backup-${getTodayString()}.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);

    updateSaveStatus(`バックアップを作成しました：${fileName}`, false);
}

function importDataFromFile(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = event => {
        try {
            const imported = JSON.parse(event.target.result);
            const records = imported.records && typeof imported.records === "object" ? imported.records : imported;

            if (!records || typeof records !== "object" || Array.isArray(records)) {
                alert("復元できません。JSONの形式が正しくありません。");
                return;
            }

            const count = Object.keys(records).length;

            if (!confirm(`JSONファイルから ${count} 件の記録を復元します。\n現在のデータは上書きされます。\n実行しますか？`)) return;

            setRecords(records);

            if (imported.settings) setSettings(imported.settings);
            if (imported.subjects) setSubjectConfigs(imported.subjects);
            if (imported.goal) setGoal(imported.goal);
            if (imported.habits) setHabits(imported.habits);
            if (imported.habitRecords) setHabitRecords(imported.habitRecords);
            if (imported.schedules) setSchedules(imported.schedules);
            if (imported.tasks) setTasks(imported.tasks);
            if (imported.scheduleTemplates) setScheduleTemplates(imported.scheduleTemplates);

            loadSettingsToForm();
            loadSubjectsToUI();
            loadGoalToForm();
            renderHabitSettingsList();
            renderScheduleTemplateList();

            const dates = Object.keys(getRecords()).sort().reverse();
            const nextDate = dates[0] || getTodayString();

            if ($("recordDate")) $("recordDate").value = nextDate;

            loadRecord(nextDate);
            updateSetupChecklist();
            updateSaveStatus(`復元しました：${count}件`, false);

            alert("復元が完了しました。");
        } catch (error) {
            console.error(error);
            alert("復元に失敗しました。JSONファイルを確認してください。");
        }
    };

    reader.readAsText(file);
}

// ==============================
// イベント
// ==============================

function setupInputEvents() {
    fieldIds.forEach(id => {
        const element = $(id);

        if (!element) return;

        element.addEventListener("input", () => {
            updateRatingDisplays();
            saveCurrentRecord();
        });

        element.addEventListener("change", () => {
            if (id === "mainSubject") updateSubSubjectSelectOptions("");

            updateRatingDisplays();
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
            showPage("todayPage");
        });
    }
}

function setupScheduleEvents() {
    if ($("saveScheduleButton")) $("saveScheduleButton").addEventListener("click", saveScheduleFromForm);
    if ($("saveScheduleAsTemplateButton")) $("saveScheduleAsTemplateButton").addEventListener("click", saveScheduleAsTemplate);
    if ($("duplicateScheduleButton")) $("duplicateScheduleButton").addEventListener("click", duplicateScheduleFromForm);
    if ($("clearScheduleFormButton")) $("clearScheduleFormButton").addEventListener("click", clearScheduleForm);
    if ($("applyScheduleToRecordButton")) $("applyScheduleToRecordButton").addEventListener("click", applyScheduleToRecord);
    if ($("importBulkScheduleButton")) $("importBulkScheduleButton").addEventListener("click", importBulkScheduleText);

    if ($("scheduleLinkedSubject")) {
        $("scheduleLinkedSubject").addEventListener("change", () => updateScheduleLinkedSubSubjectOptions(""));
    }

    if ($("monthPlanInput")) {
        $("monthPlanInput").addEventListener("change", () => {
            renderMonthlyPlanList();
            renderMonthlyCalendarGrid();
        });
    }
}

function setupTaskEvents() {
    if ($("saveTaskButton")) $("saveTaskButton").addEventListener("click", saveTaskFromForm);
    if ($("duplicateTaskButton")) $("duplicateTaskButton").addEventListener("click", duplicateTaskFromForm);
    if ($("clearTaskFormButton")) $("clearTaskFormButton").addEventListener("click", clearTaskForm);
}

function setupHabitEvents() {
    const addButton = $("addHabitButton");
    const input = $("newHabitName");

    if (addButton) addButton.addEventListener("click", addHabit);

    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addHabit();
            }
        });
    }

    document.querySelectorAll(".habit-filter-button").forEach(button => {
        button.addEventListener("click", () => {
            habitFilter = button.dataset.habitFilter || "all";

            document.querySelectorAll(".habit-filter-button").forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");
            renderTodayHabitList();
        });
    });
}

function setupSubjectEvents() {
    const addButton = $("addSubjectButton");
    const input = $("newSubjectName");

    if (addButton) addButton.addEventListener("click", addSubject);

    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addSubject();
            }
        });
    }

    if ($("mainSubject")) {
        $("mainSubject").addEventListener("change", () => {
            updateSubSubjectSelectOptions("");
        });
    }
}

function setupHistoryFilterEvents() {
    document.querySelectorAll(".filter-button").forEach(button => {
        button.addEventListener("click", () => {
            historyFilter = button.dataset.filter;

            document.querySelectorAll(".filter-button").forEach(item => {
                item.classList.remove("active");
            });

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

function setupCorrelationEvents() {
    if ($("correlationRange")) $("correlationRange").addEventListener("change", updateCorrelationAnalysis);
}

function setupBackupEvents() {
    if ($("exportButton")) $("exportButton").addEventListener("click", exportData);

    if ($("importFile")) {
        $("importFile").addEventListener("change", event => {
            importDataFromFile(event.target.files[0]);
            event.target.value = "";
        });
    }
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

// ==============================
// 全体更新
// ==============================

function updateAllDisplays() {
    updateCalculatedDisplays();
    renderScheduleTemplateList();
    renderTodayScheduleList();
    renderTodayTaskList();
    renderFocusedScheduleList();
    renderFocusedTaskList();
    renderMonthlyPlanList();
    renderHistory();
    renderRecordCalendar();
    updateWeeklySummary();
    updateAchievementSummary();
    updatePlanAnalysis();
    updateAutoAlerts();
    updateCorrelationAnalysis();
    updateSubjectAnalysis();
    updateSubSubjectAnalysis();
    renderTodayHabitList();
    updateHabitAnalysis();
    updateWeeklyReview();
    updateCharts();
    updateDeleteButton();
    updateSetupChecklist();
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
    setupHistoryFilterEvents();
    setupSettingsEvents();
    setupSubjectEvents();
    setupHabitEvents();
    setupGoalEvents();
    setupAiTextEvents();
    setupChartEvents();
    setupCorrelationEvents();

    showPage("todayPage");
    updateAllDisplays();

    console.log("Life Growth Analyzer v9.0 初期化完了");
});