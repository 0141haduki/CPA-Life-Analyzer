// Life Growth Analyzer v6.0

console.log("Life Growth Analyzer v6.0 起動");

const STORAGE_KEY = "CPA_LIFE_ANALYZER_RECORDS_V2";
const LAST_DATE_KEY = "CPA_LIFE_ANALYZER_LAST_DATE_V2";
const SETTINGS_KEY = "CPA_LIFE_ANALYZER_SETTINGS_V2";

const SUBJECTS_KEY = "LIFE_GROWTH_ANALYZER_SUBJECTS_V2";
const OLD_SUBJECTS_KEY = "LIFE_GROWTH_ANALYZER_SUBJECTS_V1";

const GOAL_KEY = "LIFE_GROWTH_ANALYZER_GOAL_V1";

const HABITS_KEY = "LIFE_GROWTH_ANALYZER_HABITS_V1";
const HABIT_RECORDS_KEY = "LIFE_GROWTH_ANALYZER_HABIT_RECORDS_V1";

const defaultSubjectConfigs = [
    {
        name: "財務会計論",
        subSubjects: ["テキスト", "問題集", "短答問題集", "理論", "計算"]
    },
    {
        name: "管理会計論",
        subSubjects: ["テキスト", "問題集", "短答問題集"]
    },
    {
        name: "監査論",
        subSubjects: ["テキスト", "短答問題集", "論文対策"]
    },
    {
        name: "企業法",
        subSubjects: ["テキスト", "短答問題集", "論文対策"]
    },
    {
        name: "租税法",
        subSubjects: ["テキスト", "問題集"]
    },
    {
        name: "経営学",
        subSubjects: ["テキスト", "問題集"]
    },
    {
        name: "英語",
        subSubjects: ["単語", "リスニング", "BBC", "TOEIC"]
    },
    {
        name: "読書",
        subSubjects: []
    },
    {
        name: "プログラミング",
        subSubjects: []
    },
    {
        name: "生活改善",
        subSubjects: []
    },
    {
        name: "その他",
        subSubjects: []
    }
];

const defaultHabits = [
    {
        id: "habit_newspaper",
        name: "新聞",
        type: "action",
        createdAt: new Date().toISOString()
    },
    {
        id: "habit_cleaning",
        name: "掃除",
        type: "action",
        createdAt: new Date().toISOString()
    },
    {
        id: "habit_abstinence",
        name: "禁欲",
        type: "avoid",
        createdAt: new Date().toISOString()
    }
];

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
let historyFilter = "7";
let activeConditionChartKey = "";

// ==============================
// 共通
// ==============================

function $(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    const element = $(id);

    if (element) {
        element.textContent = text;
    }
}

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCurrentTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function dateStringToDate(dateText) {
    const parts = String(dateText || "").split("-").map(Number);

    if (parts.length !== 3) {
        return null;
    }

    const [year, month, day] = parts;

    if (!year || !month || !day) {
        return null;
    }

    return new Date(year, month - 1, day);
}

function dateToString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateText, days) {
    const date = dateStringToDate(dateText);

    if (!date) {
        return dateText;
    }

    date.setDate(date.getDate() + days);
    return dateToString(date);
}

function formatShortDate(dateText) {
    const parts = String(dateText || "").split("-");

    if (parts.length !== 3) {
        return dateText;
    }

    return `${Number(parts[1])}/${Number(parts[2])}`;
}

function getDaysDiff(dateText) {
    const today = dateStringToDate(getTodayString());
    const target = dateStringToDate(dateText);

    if (!today || !target) {
        return 99999;
    }

    return Math.floor((today - target) / (1000 * 60 * 60 * 24));
}

function getRecentDates(days) {
    const today = getTodayString();
    const dates = [];

    for (let offset = days - 1; offset >= 0; offset--) {
        dates.push(addDays(today, -offset));
    }

    return dates;
}

function safeJsonParse(text, fallback) {
    if (!text) {
        return fallback;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("JSON読み込み失敗", error);
        return fallback;
    }
}

function getNumberOrNull(valueText) {
    if (valueText === "" || valueText === undefined || valueText === null) {
        return null;
    }

    const value = Number(valueText);

    if (Number.isNaN(value)) {
        return null;
    }

    return value;
}

function averageNumber(values) {
    const filtered = values.filter(value => value !== null && value !== undefined && !Number.isNaN(value));

    if (filtered.length === 0) {
        return null;
    }

    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function averageText(values, unit) {
    const average = averageNumber(values);

    if (average === null) {
        return "未計算";
    }

    if (unit === "%") {
        return `${average.toFixed(1)}%`;
    }

    if (unit === "時間") {
        return `${average.toFixed(1)}時間`;
    }

    return average.toFixed(1);
}

function valueOrDash(value) {
    return value === undefined || value === null || value === "" ? "未入力" : value;
}

// ==============================
// ストレージ
// ==============================

function getRecords() {
    const records = safeJsonParse(localStorage.getItem(STORAGE_KEY), {});

    if (!records || typeof records !== "object" || Array.isArray(records)) {
        return {};
    }

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
    if (!timeText) {
        return null;
    }

    const parts = timeText.split(":");

    if (parts.length !== 2) {
        return null;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
    }

    return hours * 60 + minutes;
}

function isNextDaySleep(bedtime, wakeTime) {
    const bedMinutes = timeToMinutes(bedtime);
    const wakeMinutes = timeToMinutes(wakeTime);

    if (bedMinutes === null || wakeMinutes === null) {
        return false;
    }

    return wakeMinutes <= bedMinutes;
}

function formatTimeWithNextDay(startTime, endTime) {
    if (!endTime) {
        return "未入力";
    }

    return isNextDaySleep(startTime, endTime) ? `${endTime}（翌日）` : endTime;
}

function calculateTimeInBedHours(bedtime, wakeTime) {
    const bedMinutes = timeToMinutes(bedtime);
    const wakeMinutes = timeToMinutes(wakeTime);

    if (bedMinutes === null || wakeMinutes === null) {
        return null;
    }

    let diffMinutes = wakeMinutes - bedMinutes;

    if (diffMinutes <= 0) {
        diffMinutes += 24 * 60;
    }

    return diffMinutes / 60;
}

function calculateClockGapMinutes(plannedTime, actualTime) {
    const plannedMinutes = timeToMinutes(plannedTime);
    const actualMinutes = timeToMinutes(actualTime);

    if (plannedMinutes === null || actualMinutes === null) {
        return null;
    }

    let diff = actualMinutes - plannedMinutes;

    if (diff > 720) {
        diff -= 1440;
    }

    if (diff < -720) {
        diff += 1440;
    }

    return diff;
}

function formatGapMinutes(minutes) {
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
        return "未計算";
    }

    const rounded = Math.round(minutes);

    if (rounded === 0) {
        return "±0分";
    }

    const sign = rounded > 0 ? "+" : "-";
    const abs = Math.abs(rounded);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;

    if (hours === 0) {
        return `${sign}${mins}分`;
    }

    if (mins === 0) {
        return `${sign}${hours}時間`;
    }

    return `${sign}${hours}時間${mins}分`;
}

function calculateSleepEfficiencyFromRecord(record) {
    if (!record) {
        return null;
    }

    const timeInBedHours = calculateTimeInBedHours(record.bedtime, record.wakeTime);
    const sleepHours = Number(record.sleepHours);

    if (
        timeInBedHours === null ||
        record.sleepHours === "" ||
        Number.isNaN(sleepHours) ||
        sleepHours <= 0 ||
        timeInBedHours <= 0
    ) {
        return null;
    }

    return sleepHours / timeInBedHours * 100;
}

function calculateAchievementFromRecord(record) {
    if (!record) {
        return null;
    }

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

function calculateSleepEfficiency() {
    return calculateSleepEfficiencyFromRecord(getFormData());
}

function isNightShift(workType) {
    return workType === "21-6" || workType === "21-8" || workType === "21-9";
}

function setSummaryClass(element, value, type) {
    if (!element) {
        return;
    }

    element.classList.remove("good", "warning", "danger");

    if (value === null || value === undefined || Number.isNaN(value)) {
        return;
    }

    if (type === "gap") {
        const abs = Math.abs(value);

        if (abs <= 15) {
            element.classList.add("good");
        } else if (abs <= 60) {
            element.classList.add("warning");
        } else {
            element.classList.add("danger");
        }
    }

    if (type === "achievement") {
        if (value >= 70) {
            element.classList.add("good");
        } else if (value >= 40) {
            element.classList.add("warning");
        } else {
            element.classList.add("danger");
        }
    }
}

// ==============================
// 取り組み項目・子項目
// ==============================

function normalizeSubjectConfigs(raw) {
    if (!Array.isArray(raw)) {
        return structuredClone(defaultSubjectConfigs);
    }

    if (raw.length === 0) {
        return structuredClone(defaultSubjectConfigs);
    }

    if (typeof raw[0] === "string") {
        return raw
            .map(name => String(name).trim())
            .filter(name => name !== "")
            .map(name => ({
                name,
                subSubjects: []
            }));
    }

    return raw
        .map(item => {
            if (!item) {
                return null;
            }

            const name = String(item.name || "").trim();

            if (!name) {
                return null;
            }

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

    if (current) {
        return normalizeSubjectConfigs(safeJsonParse(current, []));
    }

    const old = localStorage.getItem(OLD_SUBJECTS_KEY);

    if (old) {
        const migrated = normalizeSubjectConfigs(safeJsonParse(old, []));
        setSubjectConfigs(migrated);
        return migrated;
    }

    return structuredClone(defaultSubjectConfigs);
}

function setSubjectConfigs(configs) {
    const normalized = normalizeSubjectConfigs(configs);
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(normalized));
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

    if (!select) {
        return;
    }

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
    const parentSelect = $("mainSubject");
    const subSelect = $("subSubject");

    if (!subSelect) {
        return;
    }

    const parent = parentSelect ? parentSelect.value : "";
    const subSubjects = getSubSubjectsFor(parent);

    subSelect.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未選択";
    subSelect.appendChild(empty);

    subSubjects.forEach(sub => {
        const option = document.createElement("option");
        option.value = sub;
        option.textContent = sub;
        subSelect.appendChild(option);
    });

    if (selectedValue && !subSubjects.includes(selectedValue)) {
        const option = document.createElement("option");
        option.value = selectedValue;
        option.textContent = selectedValue;
        subSelect.appendChild(option);
    }

    subSelect.value = selectedValue || "";
}

function updateGoalPriorityOptions(selectedValue) {
    const select = $("goalPriorityItem");

    if (!select) {
        return;
    }

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

function loadSubjectsToUI() {
    const records = getRecords();
    const configs = getSubjectConfigs();

    Object.values(records).forEach(record => {
        if (!record) {
            return;
        }

        if (record.mainSubject && !configs.some(item => item.name === record.mainSubject)) {
            configs.push({
                name: record.mainSubject,
                subSubjects: []
            });
        }

        if (record.mainSubject && record.subSubject) {
            const target = configs.find(item => item.name === record.mainSubject);

            if (target && !target.subSubjects.includes(record.subSubject)) {
                target.subSubjects.push(record.subSubject);
            }
        }
    });

    setSubjectConfigs(configs);

    const currentSubject = $("mainSubject")?.value || "";
    const currentSub = $("subSubject")?.value || "";

    updateSubjectSelectOptions(currentSubject);
    updateSubSubjectSelectOptions(currentSub);
    updateGoalPriorityOptions(getGoal().priorityItem);
    renderSubjectSettingsList();
}

function addSubject() {
    const input = $("newSubjectName");

    if (!input) {
        return;
    }

    const name = input.value.trim();

    if (!name) {
        window.alert("追加する親項目名を入力してください。");
        return;
    }

    const configs = getSubjectConfigs();

    if (configs.some(item => item.name === name)) {
        window.alert("同じ親項目名がすでにあります。");
        return;
    }

    configs.push({
        name,
        subSubjects: []
    });

    setSubjectConfigs(configs);
    input.value = "";

    loadSubjectsToUI();
    updateSubjectAnalysis();
    updateSaveStatus(`親項目を追加しました：${name}`, false);
}

function deleteSubject(subjectName) {
    const configs = getSubjectConfigs();

    if (configs.length <= 1) {
        window.alert("親項目は最低1つ必要です。");
        return;
    }

    const confirmed = window.confirm(`「${subjectName}」を親項目リストから削除しますか？\n過去の記録データは削除されません。`);

    if (!confirmed) {
        return;
    }

    setSubjectConfigs(configs.filter(item => item.name !== subjectName));

    if ($("mainSubject")?.value === subjectName) {
        $("mainSubject").value = "";
        updateSubSubjectSelectOptions("");
    }

    loadSubjectsToUI();
    updateSubjectAnalysis();
    updateSaveStatus(`親項目を削除しました：${subjectName}`, false);
}

function addSubSubject(parentName) {
    const input = document.querySelector(`input[data-sub-input="${CSS.escape(parentName)}"]`);

    if (!input) {
        return;
    }

    const subName = input.value.trim();

    if (!subName) {
        window.alert("追加する子項目名を入力してください。");
        return;
    }

    const configs = getSubjectConfigs();
    const parent = configs.find(item => item.name === parentName);

    if (!parent) {
        return;
    }

    if (parent.subSubjects.includes(subName)) {
        window.alert("同じ子項目名がすでにあります。");
        return;
    }

    parent.subSubjects.push(subName);
    setSubjectConfigs(configs);

    input.value = "";
    loadSubjectsToUI();

    if ($("mainSubject")?.value === parentName) {
        updateSubSubjectSelectOptions($("subSubject")?.value || "");
    }

    updateSaveStatus(`子項目を追加しました：${parentName} / ${subName}`, false);
}

function deleteSubSubject(parentName, subName) {
    const confirmed = window.confirm(`「${parentName}」の子項目「${subName}」を削除しますか？\n過去の記録データは削除されません。`);

    if (!confirmed) {
        return;
    }

    const configs = getSubjectConfigs();
    const parent = configs.find(item => item.name === parentName);

    if (!parent) {
        return;
    }

    parent.subSubjects = parent.subSubjects.filter(item => item !== subName);
    setSubjectConfigs(configs);

    if ($("mainSubject")?.value === parentName && $("subSubject")?.value === subName) {
        $("subSubject").value = "";
    }

    loadSubjectsToUI();
    updateSubjectAnalysis();
    updateSaveStatus(`子項目を削除しました：${parentName} / ${subName}`, false);
}

function renderSubjectSettingsList() {
    const list = $("subjectSettingsList");

    if (!list) {
        return;
    }

    const configs = getSubjectConfigs();

    list.innerHTML = "";

    if (configs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "親項目がありません。";
        list.appendChild(empty);
        return;
    }

    configs.forEach(config => {
        const item = document.createElement("div");
        item.className = "subject-setting-item";

        const subItems = config.subSubjects.length === 0
            ? `<p class="empty">子項目は未設定です。</p>`
            : config.subSubjects.map(sub => `
                <div class="subsubject-item">
                    <span class="subsubject-name">${sub}</span>
                    <button type="button" class="subsubject-delete-button" data-parent="${config.name}" data-sub="${sub}">削除</button>
                </div>
            `).join("");

        item.innerHTML = `
            <div class="subject-setting-main">
                <span class="subject-setting-name">${config.name}</span>
                <button type="button" class="subject-delete-button" data-subject="${config.name}">親項目を削除</button>
            </div>

            <div class="subsubject-box">
                <div class="subsubject-list">
                    ${subItems}
                </div>

                <div class="subsubject-input-row">
                    <input type="text" data-sub-input="${config.name}" placeholder="例：テキスト、問題集、新聞記事名">
                    <button type="button" class="subsubject-add-button" data-parent="${config.name}">子項目追加</button>
                </div>
            </div>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll(".subject-delete-button").forEach(button => {
        button.addEventListener("click", () => {
            deleteSubject(button.dataset.subject);
        });
    });

    list.querySelectorAll(".subsubject-add-button").forEach(button => {
        button.addEventListener("click", () => {
            addSubSubject(button.dataset.parent);
        });
    });

    list.querySelectorAll(".subsubject-delete-button").forEach(button => {
        button.addEventListener("click", () => {
            deleteSubSubject(button.dataset.parent, button.dataset.sub);
        });
    });
}

function setupSubjectEvents() {
    const addButton = $("addSubjectButton");
    const input = $("newSubjectName");
    const mainSubject = $("mainSubject");

    if (addButton) {
        addButton.addEventListener("click", addSubject);
    }

    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addSubject();
            }
        });
    }

    if (mainSubject) {
        mainSubject.addEventListener("change", () => {
            updateSubSubjectSelectOptions("");
        });
    }
}

// ==============================
// 継続項目
// ==============================

function createHabitId(name) {
    return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${name.replace(/\s+/g, "_")}`;
}

function normalizeHabits(raw) {
    if (!Array.isArray(raw)) {
        return structuredClone(defaultHabits);
    }

    const cleaned = raw
        .map(item => {
            if (!item) {
                return null;
            }

            const name = String(item.name || "").trim();

            if (!name) {
                return null;
            }

            return {
                id: item.id || createHabitId(name),
                name,
                type: item.type === "avoid" ? "avoid" : "action",
                createdAt: item.createdAt || new Date().toISOString()
            };
        })
        .filter(Boolean);

    return cleaned.length > 0 ? cleaned : structuredClone(defaultHabits);
}

function getHabits() {
    return normalizeHabits(safeJsonParse(localStorage.getItem(HABITS_KEY), defaultHabits));
}

function setHabits(habits) {
    localStorage.setItem(HABITS_KEY, JSON.stringify(normalizeHabits(habits)));
}

function getHabitRecords() {
    const records = safeJsonParse(localStorage.getItem(HABIT_RECORDS_KEY), {});

    if (!records || typeof records !== "object" || Array.isArray(records)) {
        return {};
    }

    return records;
}

function setHabitRecords(records) {
    localStorage.setItem(HABIT_RECORDS_KEY, JSON.stringify(records));
}

function getHabitRecordForDate(date) {
    const records = getHabitRecords();
    return records[date] || {};
}

function setHabitResult(date, habitId, result) {
    const records = getHabitRecords();

    if (!records[date]) {
        records[date] = {};
    }

    records[date][habitId] = {
        result,
        updatedAt: new Date().toISOString()
    };

    setHabitRecords(records);
    updateAfterDataChange();
    updateSaveStatus(`継続項目を記録しました：${date}`, false);
}

function clearHabitResult(date, habitId) {
    const records = getHabitRecords();

    if (records[date] && records[date][habitId]) {
        delete records[date][habitId];
    }

    setHabitRecords(records);
    updateAfterDataChange();
    updateSaveStatus(`継続項目の記録を取り消しました：${date}`, false);
}

function getHabitResult(date, habitId) {
    const dayRecord = getHabitRecordForDate(date);

    if (!dayRecord[habitId]) {
        return null;
    }

    return dayRecord[habitId].result === true;
}

function getHabitStreakUntil(date, habitId) {
    let count = 0;
    let cursor = date;

    for (let i = 0; i < 1000; i++) {
        const result = getHabitResult(cursor, habitId);

        if (result === true) {
            count += 1;
            cursor = addDays(cursor, -1);
        } else {
            break;
        }
    }

    return count;
}

function getPreviousSuccessfulDate(date, habitId) {
    let cursor = addDays(date, -1);

    for (let i = 0; i < 1000; i++) {
        if (getHabitResult(cursor, habitId) === true) {
            return cursor;
        }

        cursor = addDays(cursor, -1);
    }

    return "";
}

function getHabitButtonLabel(habit, date) {
    const todayResult = getHabitResult(date, habit.id);
    const previousResult = getHabitResult(addDays(date, -1), habit.id);

    if (todayResult === true) {
        return habit.type === "avoid" ? "継続済み" : "実行済み";
    }

    if (previousResult === true) {
        return "継続";
    }

    const previousSuccess = getPreviousSuccessfulDate(date, habit.id);

    if (previousSuccess) {
        return "再開";
    }

    return "実行";
}

function getHabitStatusText(habit, date) {
    const todayResult = getHabitResult(date, habit.id);
    const currentStreak = getHabitStreakUntil(date, habit.id);
    const previousStreak = getHabitStreakUntil(addDays(date, -1), habit.id);
    const previousSuccess = getPreviousSuccessfulDate(date, habit.id);

    if (todayResult === true) {
        return `今日達成済み。現在 ${currentStreak}日継続中。`;
    }

    if (todayResult === false) {
        return habit.type === "avoid"
            ? "今日は途切れた記録になっています。"
            : "今日は未達成として記録されています。";
    }

    if (previousStreak > 0) {
        return `昨日まで ${previousStreak}日継続中。今日もできたら継続です。`;
    }

    if (previousSuccess) {
        return `前回達成：${previousSuccess}。今日は再開できます。`;
    }

    return "まだ達成記録がありません。今日が初回です。";
}

function renderTodayHabitList() {
    const list = $("todayHabitList");

    if (!list) {
        return;
    }

    const date = $("recordDate")?.value || getTodayString();
    const habits = getHabits();

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目を設定すると、ここに表示されます。";
        list.appendChild(empty);
        return;
    }

    habits.forEach(habit => {
        const result = getHabitResult(date, habit.id);
        const item = document.createElement("div");
        item.className = "today-habit-item";

        const label = getHabitButtonLabel(habit, date);
        const typeText = habit.type === "avoid" ? "回避型" : "実行型";
        const typeClass = habit.type === "avoid" ? "avoid" : "action";

        const secondaryButton = result === true
            ? `<button type="button" class="habit-action-button break" data-habit-clear="${habit.id}">取消</button>`
            : habit.type === "avoid"
                ? `<button type="button" class="habit-action-button break" data-habit-break="${habit.id}">途切れた</button>`
                : `<button type="button" class="habit-action-button break" data-habit-fail="${habit.id}">未達成</button>`;

        item.innerHTML = `
            <div class="today-habit-header">
                <span class="today-habit-name">${habit.name}</span>
                <span class="today-habit-type ${typeClass}">${typeText}</span>
            </div>

            <p class="today-habit-status">${getHabitStatusText(habit, date)}</p>

            <div class="habit-button-row">
                <button type="button" class="habit-action-button ${result === true ? "done" : ""}" data-habit-success="${habit.id}">
                    ${label}
                </button>
                ${secondaryButton}
            </div>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-habit-success]").forEach(button => {
        button.addEventListener("click", () => {
            setHabitResult(date, button.dataset.habitSuccess, true);
        });
    });

    list.querySelectorAll("[data-habit-break]").forEach(button => {
        button.addEventListener("click", () => {
            setHabitResult(date, button.dataset.habitBreak, false);
        });
    });

    list.querySelectorAll("[data-habit-fail]").forEach(button => {
        button.addEventListener("click", () => {
            setHabitResult(date, button.dataset.habitFail, false);
        });
    });

    list.querySelectorAll("[data-habit-clear]").forEach(button => {
        button.addEventListener("click", () => {
            clearHabitResult(date, button.dataset.habitClear);
        });
    });
}

function addHabit() {
    const nameInput = $("newHabitName");
    const typeSelect = $("newHabitType");

    if (!nameInput || !typeSelect) {
        return;
    }

    const name = nameInput.value.trim();
    const type = typeSelect.value === "avoid" ? "avoid" : "action";

    if (!name) {
        window.alert("追加する継続項目名を入力してください。");
        return;
    }

    const habits = getHabits();

    if (habits.some(habit => habit.name === name)) {
        window.alert("同じ継続項目名がすでにあります。");
        return;
    }

    habits.push({
        id: createHabitId(name),
        name,
        type,
        createdAt: new Date().toISOString()
    });

    setHabits(habits);

    nameInput.value = "";

    renderHabitSettingsList();
    renderTodayHabitList();
    updateHabitAnalysis();

    updateSaveStatus(`継続項目を追加しました：${name}`, false);
}

function deleteHabit(habitId) {
    const habits = getHabits();
    const habit = habits.find(item => item.id === habitId);

    if (!habit) {
        return;
    }

    const confirmed = window.confirm(`継続項目「${habit.name}」を削除しますか？\n過去の達成記録は残りますが、通常表示からは外れます。`);

    if (!confirmed) {
        return;
    }

    setHabits(habits.filter(item => item.id !== habitId));

    renderHabitSettingsList();
    renderTodayHabitList();
    updateHabitAnalysis();
    updateSaveStatus(`継続項目を削除しました：${habit.name}`, false);
}

function renderHabitSettingsList() {
    const list = $("habitSettingsList");

    if (!list) {
        return;
    }

    const habits = getHabits();

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目がありません。";
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
                <span class="habit-setting-name">${habit.name}</span>
                <span class="habit-setting-detail">${typeText}</span>
            </div>
            <button type="button" class="habit-delete-button" data-habit-delete="${habit.id}">削除</button>
        `;

        list.appendChild(item);
    });

    list.querySelectorAll("[data-habit-delete]").forEach(button => {
        button.addEventListener("click", () => {
            deleteHabit(button.dataset.habitDelete);
        });
    });
}

function setupHabitEvents() {
    const addButton = $("addHabitButton");
    const input = $("newHabitName");

    if (addButton) {
        addButton.addEventListener("click", addHabit);
    }

    if (input) {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addHabit();
            }
        });
    }
}

// ==============================
// フォーム・保存
// ==============================

function getFormData() {
    const data = {};

    fieldIds.forEach(id => {
        const element = $(id);

        if (element) {
            data[id] = element.value;
        }
    });

    return data;
}

function setFormData(data) {
    const settings = getSettings();

    updateSubjectSelectOptions(data.mainSubject || "");
    updateSubSubjectSelectOptions(data.subSubject || "");

    fieldIds.forEach(id => {
        const element = $(id);

        if (element) {
            element.value = data[id] ?? "";
        }
    });

    if (!data.plannedBedtime && $("plannedBedtime")) {
        $("plannedBedtime").value = settings.defaultPlannedBedtime;
    }

    if (!data.plannedWakeTime && $("plannedWakeTime")) {
        $("plannedWakeTime").value = settings.defaultPlannedWakeTime;
    }

    updateRatingDisplays();
    updateAllCalculatedDisplays();
}

function clearForm() {
    fieldIds.forEach(id => {
        const element = $(id);

        if (element) {
            element.value = "";
        }
    });

    updateSubSubjectSelectOptions("");
    updateRatingDisplays();
    updateAllCalculatedDisplays();
}

function applyDefaultPlanToForm() {
    const settings = getSettings();

    if ($("plannedBedtime")) {
        $("plannedBedtime").value = settings.defaultPlannedBedtime;
    }

    if ($("plannedWakeTime")) {
        $("plannedWakeTime").value = settings.defaultPlannedWakeTime;
    }
}

function saveCurrentRecord() {
    const dateElement = $("recordDate");

    if (!dateElement || !dateElement.value) {
        return;
    }

    const date = dateElement.value;
    const records = getRecords();

    records[date] = getFormData();

    setRecords(records);
    localStorage.setItem(LAST_DATE_KEY, date);

    currentDate = date;

    updateAllCalculatedDisplays();

    const warnings = validateCurrentRecord();

    updateSaveStatus(
        warnings.length > 0
            ? `保存しました：${date} ${getCurrentTimeString()}　※確認あり`
            : `保存しました：${date} ${getCurrentTimeString()}`,
        warnings.length > 0
    );

    updateAfterDataChange();
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
        updateAllCalculatedDisplays();
        updateSaveStatus(`新しい記録です：${date}`, false);
    }

    localStorage.setItem(LAST_DATE_KEY, date);
    currentDate = date;

    updateAllCalculatedDisplays();
    updateAfterDataChange();
}

function updateAfterDataChange() {
    renderHistory();
    renderRecordCalendar();
    updateWeeklySummary();
    updateAchievementSummary();
    updateDeleteButton();
    updateCharts();
    updateAutoAlerts();
    updateCorrelationAnalysis();
    updateSubjectAnalysis();
    renderTodayHabitList();
    updateHabitAnalysis();
}

function updateSaveStatus(message, hasWarning) {
    const status = $("saveStatus");
    const statusCard = document.querySelector(".status-card");

    if (status) {
        status.textContent = message;
    }

    if (statusCard) {
        statusCard.classList.toggle("warning", Boolean(hasWarning));
    }
}

// ==============================
// 設定・目標
// ==============================

function loadSettingsToForm() {
    const settings = getSettings();

    if ($("defaultPlannedBedtime")) {
        $("defaultPlannedBedtime").value = settings.defaultPlannedBedtime;
    }

    if ($("defaultPlannedWakeTime")) {
        $("defaultPlannedWakeTime").value = settings.defaultPlannedWakeTime;
    }

    updateSettingsStatus();
}

function saveSettingsFromForm() {
    const settings = {
        defaultPlannedBedtime: $("defaultPlannedBedtime")?.value || "",
        defaultPlannedWakeTime: $("defaultPlannedWakeTime")?.value || ""
    };

    setSettings(settings);
    updateSettingsStatus();

    if ($("plannedBedtime") && !$("plannedBedtime").value) {
        $("plannedBedtime").value = settings.defaultPlannedBedtime;
    }

    if ($("plannedWakeTime") && !$("plannedWakeTime").value) {
        $("plannedWakeTime").value = settings.defaultPlannedWakeTime;
    }

    saveCurrentRecord();
    window.alert("基本睡眠予定を保存しました。");
}

function updateSettingsStatus() {
    const settings = getSettings();

    if (!$("settingsStatus")) {
        return;
    }

    if (settings.defaultPlannedBedtime && settings.defaultPlannedWakeTime) {
        $("settingsStatus").textContent = `設定中：${settings.defaultPlannedBedtime} 〜 ${settings.defaultPlannedWakeTime}`;
    } else {
        $("settingsStatus").textContent = "未設定";
    }
}

function loadGoalToForm() {
    const goal = getGoal();

    if ($("goalTitle")) {
        $("goalTitle").value = goal.title;
    }

    if ($("goalReason")) {
        $("goalReason").value = goal.reason;
    }

    updateGoalPriorityOptions(goal.priorityItem);

    if ($("goalMinimumMinutes")) {
        $("goalMinimumMinutes").value = goal.minimumMinutes;
    }

    if ($("goalStandardMinutes")) {
        $("goalStandardMinutes").value = goal.standardMinutes;
    }

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
    updateSubjectAnalysis();
    updateAutoAlerts();
    updateSaveStatus("目標設定を保存しました", false);
    window.alert("目標設定を保存しました。");
}

function updateGoalStatus() {
    const status = $("goalStatus");

    if (!status) {
        return;
    }

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
// 表示計算
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

    if (valueText === "") {
        return warnings;
    }

    const value = Number(valueText);

    if (Number.isNaN(value)) {
        warnings.push(`${label}は数値で入力してください`);
    } else if (value < min || value > max) {
        warnings.push(`${label}は${min}〜${max}で入力してください`);
    }

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
        if (sleepHours === null) {
            warnings.push("実睡眠時間は数値で入力してください");
        } else {
            if (sleepHours < 0) {
                warnings.push("実睡眠時間は0以上で入力してください");
            }

            if (sleepHours > 16) {
                warnings.push("実睡眠時間が16時間を超えています。入力値を確認してください");
            }

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
        if (studyTotal === null) {
            warnings.push("取り組み時間は数値で入力してください");
        } else if (studyTotal < 0) {
            warnings.push("取り組み時間は0分以上で入力してください");
        } else if (studyTotal > 960) {
            warnings.push("取り組み時間が16時間を超えています。入力値を確認してください");
        }
    }

    return warnings;
}

function updateWarnings() {
    const warningList = $("warningList");
    const warningCard = $("warningCard");

    if (!warningList) {
        return;
    }

    const warnings = validateCurrentRecord();
    warningList.innerHTML = "";

    if (warnings.length === 0) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "問題は見つかっていません";
        warningList.appendChild(item);

        if (warningCard) {
            warningCard.classList.add("ok");
        }

        return;
    }

    if (warningCard) {
        warningCard.classList.remove("ok");
    }

    warnings.forEach(message => {
        const item = document.createElement("li");
        item.textContent = message;
        warningList.appendChild(item);
    });
}

function addAdviceItem(list, text, className) {
    const item = document.createElement("li");
    item.textContent = text;

    if (className) {
        item.classList.add(className);
    }

    list.appendChild(item);
}

function updateTodayAdvice() {
    const main = $("todayAdviceMain");
    const list = $("todayAdviceList");

    if (!main || !list) {
        return;
    }

    const record = getFormData();
    const goal = getGoal();
    const date = $("recordDate")?.value || getTodayString();

    const sleepHours = getNumberOrNull(record.sleepHours);
    const sleepiness = getNumberOrNull(record.sleepiness);
    const fatigue = getNumberOrNull(record.fatigue);
    const focus = getNumberOrNull(record.focus);
    const studyTotal = getNumberOrNull(record.studyTotal);
    const achievedHabits = getHabitAchievementCount(date);

    const adviceItems = [];
    let mainText = "今日の状態を入力すると、行動の優先順位を表示します。";

    if (sleepHours !== null && sleepHours < 5) {
        mainText = "今日は回復優先です。重い取り組みより、睡眠と最低限の継続を優先してください。";
        adviceItems.push({
            text: "実睡眠が5時間未満です。新規内容や長時間作業は抑え、短い確認・習慣の最低継続に寄せてください。",
            className: "priority-high"
        });
    } else if (sleepHours !== null && sleepHours < 6) {
        mainText = "睡眠がやや不足しています。量よりも継続を優先してください。";
        adviceItems.push({
            text: "実睡眠が6時間未満です。取り組みは5〜15分単位に分ける方が安全です。",
            className: "priority-middle"
        });
    } else if (sleepHours !== null && sleepHours >= 7) {
        adviceItems.push({
            text: "実睡眠は十分寄りです。集中力が悪くなければ、優先項目を進めやすい日です。",
            className: "priority-good"
        });
    }

    if (fatigue !== null && fatigue >= 8) {
        mainText = "疲労が強い日です。成果最大化より、崩れない運用を優先してください。";
        adviceItems.push({
            text: "疲労が8以上です。継続項目だけ守り、時間型の取り組みは短く切るのが現実的です。",
            className: "priority-high"
        });
    }

    if (sleepiness !== null && sleepiness >= 8) {
        adviceItems.push({
            text: "眠気が強いです。仮眠・食事・入浴・室温調整のどれかを入れてから取り組んでください。",
            className: "priority-high"
        });
    }

    if (focus !== null && focus >= 8) {
        const target = goal.priorityItem || record.mainSubject || "重要な項目";
        adviceItems.push({
            text: `集中力が高めです。「${target}」を進める好機です。`,
            className: "priority-good"
        });
    } else if (focus !== null && focus <= 3) {
        adviceItems.push({
            text: "集中力が低めです。新しい内容より、継続項目・整理・復習が向いています。",
            className: "priority-middle"
        });
    }

    if (studyTotal !== null) {
        if (studyTotal === 0) {
            adviceItems.push({
                text: "取り組み時間が0分です。今日は5分だけでも記録を作ると再開しやすくなります。",
                className: "priority-middle"
            });
        } else if (studyTotal >= 180) {
            adviceItems.push({
                text: "取り組み時間は十分です。追加で詰め込むより、睡眠予定を崩さないことを優先してください。",
                className: "priority-good"
            });
        }
    }

    if (achievedHabits > 0) {
        adviceItems.push({
            text: `今日は継続項目を${achievedHabits}件達成しています。小さい習慣の継続はできています。`,
            className: "priority-good"
        });
    }

    if (goal.title && goal.priorityItem && record.mainSubject && record.mainSubject !== goal.priorityItem) {
        adviceItems.push({
            text: `現在の優先項目は「${goal.priorityItem}」です。今日の中心が別項目なら、優先項目に5分だけ触れるか確認してください。`,
            className: "priority-middle"
        });
    }

    if (record.workType && isNightShift(record.workType)) {
        adviceItems.push({
            text: "夜勤系勤務です。勤務前後に重い取り組みを置きすぎず、睡眠確保を最優先にしてください。",
            className: "priority-middle"
        });
    }

    if (adviceItems.length === 0) {
        adviceItems.push({
            text: "睡眠・体調・取り組み時間・習慣のいずれかを入力すると、助言が具体化します。",
            className: "priority-middle"
        });
    }

    main.textContent = mainText;
    list.innerHTML = "";
    adviceItems.slice(0, 5).forEach(item => addAdviceItem(list, item.text, item.className));
}

function updateAllCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
    updateTodayAdvice();
}

// ==============================
// 習慣分析
// ==============================

function getHabitAchievementCount(date) {
    const habits = getHabits();
    return habits.filter(habit => getHabitResult(date, habit.id) === true).length;
}

function getHabitAchievementRate(habitId, days) {
    const dates = getRecentDates(days);
    let achieved = 0;
    let recorded = 0;

    dates.forEach(date => {
        const result = getHabitResult(date, habitId);

        if (result !== null) {
            recorded += 1;

            if (result === true) {
                achieved += 1;
            }
        }
    });

    return {
        achieved,
        recorded,
        rate: days === 0 ? 0 : achieved / days * 100
    };
}

function getHabitEffectText(habit) {
    const dates = getRecentDates(30);
    const records = getRecords();

    const achievedFocus = [];
    const notAchievedFocus = [];
    const achievedMood = [];
    const notAchievedMood = [];
    const achievedSleep = [];
    const notAchievedSleep = [];

    dates.forEach(date => {
        const record = records[date];

        if (!record) {
            return;
        }

        const result = getHabitResult(date, habit.id);
        const focus = getNumberOrNull(record.focus);
        const mood = getNumberOrNull(record.mood);
        const sleep = getNumberOrNull(record.sleepHours);

        if (result === true) {
            if (focus !== null) achievedFocus.push(focus);
            if (mood !== null) achievedMood.push(mood);
            if (sleep !== null) achievedSleep.push(sleep);
        } else if (result === false) {
            if (focus !== null) notAchievedFocus.push(focus);
            if (mood !== null) notAchievedMood.push(mood);
            if (sleep !== null) notAchievedSleep.push(sleep);
        }
    });

    const focusA = averageNumber(achievedFocus);
    const focusN = averageNumber(notAchievedFocus);
    const moodA = averageNumber(achievedMood);
    const moodN = averageNumber(notAchievedMood);
    const sleepA = averageNumber(achievedSleep);
    const sleepN = averageNumber(notAchievedSleep);

    const comments = [];

    if (focusA !== null && focusN !== null && achievedFocus.length >= 3 && notAchievedFocus.length >= 3) {
        comments.push(`達成日の平均集中力 ${focusA.toFixed(1)} / 未達成日 ${focusN.toFixed(1)}`);
    }

    if (moodA !== null && moodN !== null && achievedMood.length >= 3 && notAchievedMood.length >= 3) {
        comments.push(`達成日の平均気分 ${moodA.toFixed(1)} / 未達成日 ${moodN.toFixed(1)}`);
    }

    if (sleepA !== null && sleepN !== null && achievedSleep.length >= 3 && notAchievedSleep.length >= 3) {
        comments.push(`達成日の平均睡眠 ${sleepA.toFixed(1)}h / 未達成日 ${sleepN.toFixed(1)}h`);
    }

    if (comments.length === 0) {
        return "影響分析には、達成日と未達成日の体調記録がもう少し必要です。";
    }

    return comments.join("。");
}

function updateHabitAnalysis() {
    const list = $("habitAnalysisList");
    const comment = $("habitAnalysisComment");

    if (!list) {
        return;
    }

    const habits = getHabits();
    const date = $("recordDate")?.value || getTodayString();

    list.innerHTML = "";

    if (habits.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "継続項目を設定すると、分析が表示されます。";
        list.appendChild(empty);

        if (comment) {
            comment.textContent = "継続項目がありません。";
        }

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
            <p class="habit-analysis-title">${habit.name}</p>
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
            <p class="habit-effect-text">${getHabitEffectText(habit)}</p>
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
// 自動検知
// ==============================

function makeAlert(level, title, message, action, priority, key) {
    return { level, title, message, action, priority, key };
}

function getDatesWithRecords(days) {
    const records = getRecords();
    const dates = days === "all" ? Object.keys(records).sort() : getRecentDates(days);
    return dates.filter(date => records[date]).sort();
}

function getRecentRecords(days) {
    const records = getRecords();
    return getDatesWithRecords(days).map(date => ({ date, record: records[date] }));
}

function getConsecutiveCountFromEnd(items, predicate) {
    let count = 0;

    for (let i = items.length - 1; i >= 0; i--) {
        if (predicate(items[i])) {
            count += 1;
        } else {
            break;
        }
    }

    return count;
}

function detectAutoAlerts() {
    const alerts = [];
    const items7 = getRecentRecords(7);
    const items14 = getRecentRecords(14);
    const goal = getGoal();
    const today = $("recordDate")?.value || getTodayString();

    if (items7.length === 0) {
        return [
            makeAlert("medium", "記録がまだありません", "睡眠・体調・取り組み・習慣の記録が必要です。", "まずは1日1回、睡眠時間と継続項目だけでも記録してください。", 50, "no-record")
        ];
    }

    const latest = items7[items7.length - 1];
    const record = latest.record;

    const currentSleep = getNumberOrNull(record.sleepHours);
    const currentFatigue = getNumberOrNull(record.fatigue);
    const currentSleepiness = getNumberOrNull(record.sleepiness);
    const currentFocus = getNumberOrNull(record.focus);
    const currentStudy = getNumberOrNull(record.studyTotal);

    const sleepValues = [];
    const focusValues = [];
    const fatigueValues = [];
    const sleepinessValues = [];
    const studyValues = [];
    const bedtimeGaps = [];
    const wakeGaps = [];

    let achievedDays = 0;
    let judgedDays = 0;
    let nightShiftDays = 0;
    let nightShiftProblem = 0;

    items7.forEach(item => {
        const r = item.record;
        const sleep = getNumberOrNull(r.sleepHours);
        const focus = getNumberOrNull(r.focus);
        const fatigue = getNumberOrNull(r.fatigue);
        const sleepiness = getNumberOrNull(r.sleepiness);
        const study = getNumberOrNull(r.studyTotal);
        const achievement = calculateAchievementFromRecord(r);

        if (sleep !== null) sleepValues.push(sleep);
        if (focus !== null) focusValues.push(focus);
        if (fatigue !== null) fatigueValues.push(fatigue);
        if (sleepiness !== null) sleepinessValues.push(sleepiness);
        if (study !== null) studyValues.push(study);

        if (achievement) {
            if (achievement.bedtimeGap !== null) bedtimeGaps.push(achievement.bedtimeGap);
            if (achievement.wakeTimeGap !== null) wakeGaps.push(achievement.wakeTimeGap);

            if (achievement.canJudgeAchievement) {
                judgedDays += 1;
                if (achievement.achieved) achievedDays += 1;
            }
        }

        if (isNightShift(r.workType)) {
            nightShiftDays += 1;

            if (
                (sleep !== null && sleep < 6) ||
                (fatigue !== null && fatigue >= 8) ||
                (sleepiness !== null && sleepiness >= 8)
            ) {
                nightShiftProblem += 1;
            }
        }
    });

    const avgSleep = averageNumber(sleepValues);
    const avgFocus = averageNumber(focusValues);
    const avgFatigue = averageNumber(fatigueValues);
    const avgSleepiness = averageNumber(sleepinessValues);
    const avgBedtimeGap = averageNumber(bedtimeGaps);
    const avgWakeGap = averageNumber(wakeGaps);

    const studyDays = studyValues.filter(value => value > 0).length;
    const achievementRate = judgedDays === 0 ? null : achievedDays / judgedDays * 100;

    const shortSleepStreak = getConsecutiveCountFromEnd(items14, item => {
        const sleep = getNumberOrNull(item.record.sleepHours);
        return sleep !== null && sleep < 6;
    });

    const studyZeroStreak = getConsecutiveCountFromEnd(items14, item => {
        const study = getNumberOrNull(item.record.studyTotal);
        return study !== null && study === 0;
    });

    const fatigueStreak = getConsecutiveCountFromEnd(items14, item => {
        const fatigue = getNumberOrNull(item.record.fatigue);
        return fatigue !== null && fatigue >= 7;
    });

    const sleepinessStreak = getConsecutiveCountFromEnd(items14, item => {
        const sleepiness = getNumberOrNull(item.record.sleepiness);
        return sleepiness !== null && sleepiness >= 7;
    });

    if (currentSleep !== null && currentSleep < 5) {
        alerts.push(makeAlert("high", "今日の実睡眠が5時間未満です", `今日の実睡眠は${currentSleep.toFixed(1)}時間です。`, "重い取り組みより、睡眠と最低限の習慣継続を優先してください。", 100, "today-short-sleep"));
    }

    if (shortSleepStreak >= 2) {
        alerts.push(makeAlert("high", `実睡眠6時間未満が${shortSleepStreak}日続いています`, "睡眠不足が連続しています。", "取り組み量の最大化より、睡眠枠の確保を優先してください。", 95, "sleep-streak"));
    }

    if (currentFatigue !== null && currentFatigue >= 8) {
        alerts.push(makeAlert("high", "今日の疲労が強いです", `疲労は${currentFatigue}/10です。`, "最低限の取り組みだけ決め、回復行動を先に入れてください。", 94, "today-fatigue"));
    }

    if (currentSleepiness !== null && currentSleepiness >= 8) {
        alerts.push(makeAlert("high", "今日の眠気が強いです", `眠気は${currentSleepiness}/10です。`, "仮眠・食事・入浴・室温調整のどれかを入れてください。", 93, "today-sleepiness"));
    }

    if (fatigueStreak >= 2) {
        alerts.push(makeAlert("high", `疲労7以上が${fatigueStreak}日続いています`, "疲労が高止まりしています。", "重要項目は5〜15分だけ触れる運用にしてください。", 88, "fatigue-streak"));
    }

    if (sleepinessStreak >= 2) {
        alerts.push(makeAlert("high", `眠気7以上が${sleepinessStreak}日続いています`, "眠気が高止まりしています。", "睡眠時間・睡眠効率・夜勤後の回復不足を確認してください。", 87, "sleepiness-streak"));
    }

    if (avgSleep !== null && avgSleep < 6) {
        alerts.push(makeAlert("medium", "直近7日の平均実睡眠が6時間未満です", `平均実睡眠は${avgSleep.toFixed(1)}時間です。`, "睡眠予定を現実的に修正してください。", 82, "avg-sleep"));
    }

    if (avgFocus !== null && avgFocus <= 4) {
        alerts.push(makeAlert("medium", "直近7日の平均集中力が低めです", `平均集中力は${avgFocus.toFixed(1)}です。`, "長く取り組むより、5〜15分単位で着手してください。", 75, "avg-focus"));
    }

    if (studyZeroStreak >= 2) {
        alerts.push(makeAlert("medium", `取り組み0分が${studyZeroStreak}日続いています`, "再開ハードルが上がり始めています。", "今日は5分だけでも記録を作ってください。", 72, "study-zero-streak"));
    }

    if (studyDays <= 2 && items7.length >= 4) {
        alerts.push(makeAlert("medium", "直近7日の取り組み日数が少なめです", `取り組んだ日は${studyDays}日です。`, "毎日長時間ではなく、最低5〜15分の固定枠を作ってください。", 68, "study-days"));
    }

    if (goal.title && goal.priorityItem) {
        const priorityStats = buildSubjectStats(7).items.find(item => item.subject === goal.priorityItem);

        if (!priorityStats || priorityStats.minutes === 0) {
            alerts.push(makeAlert("medium", "優先項目に触れていません", `目標の優先項目「${goal.priorityItem}」が直近7日で未着手です。`, "今日は5分だけでも優先項目に触れてください。", 67, "priority-item"));
        }
    }

    if (currentFocus !== null && currentFocus >= 7 && currentStudy !== null && currentStudy === 0) {
        alerts.push(makeAlert("medium", "集中力があるのに取り組み0分です", "状態は悪くないのに着手できていない可能性があります。", "5〜15分だけでも優先項目に触れてください。", 66, "focus-miss"));
    }

    if (avgBedtimeGap !== null && Math.abs(avgBedtimeGap) > 60) {
        alerts.push(makeAlert("medium", "平均就寝ズレが大きいです", `平均就寝ズレは${formatGapMinutes(avgBedtimeGap)}です。`, "守れる睡眠予定に修正してください。", 64, "bed-gap"));
    }

    if (avgWakeGap !== null && Math.abs(avgWakeGap) > 60) {
        alerts.push(makeAlert("medium", "平均起床ズレが大きいです", `平均起床ズレは${formatGapMinutes(avgWakeGap)}です。`, "就寝時刻と睡眠時間の不足を確認してください。", 63, "wake-gap"));
    }

    if (achievementRate !== null && achievementRate < 40) {
        alerts.push(makeAlert("medium", "予定達成率が低めです", `直近7日の予定達成率は${achievementRate.toFixed(0)}%です。`, "予定を30〜60分単位で現実側へ寄せてください。", 62, "achievement"));
    }

    if (nightShiftDays > 0 && nightShiftProblem > 0) {
        alerts.push(makeAlert("medium", "夜勤後の回復不足が見られます", `夜勤系勤務${nightShiftDays}回のうち、${nightShiftProblem}回で回復不足が見られます。`, "夜勤後は取り組み量より睡眠確保を成功条件にしてください。", 60, "night-shift"));
    }

    const habitAchievements = getHabitAchievementCount(today);

    if (habitAchievements === 0 && getHabits().length > 0) {
        alerts.push(makeAlert("medium", "今日は継続項目が未達成です", "小さい習慣がまだ記録されていません。", "新聞・掃除・禁欲など、1つだけでも記録してください。", 59, "habit-none"));
    }

    getHabits().forEach(habit => {
        const rate7 = getHabitAchievementRate(habit.id, 7);

        if (rate7.rate >= 80) {
            alerts.push(makeAlert("good", `「${habit.name}」がよく継続できています`, `直近7日の達成率は${rate7.rate.toFixed(0)}%です。`, "この習慣を崩さないことを優先してください。", 25, `habit-good-${habit.id}`));
        }
    });

    if (
        avgSleep !== null &&
        avgSleep >= 6.5 &&
        avgFatigue !== null &&
        avgFatigue <= 6 &&
        avgSleepiness !== null &&
        avgSleepiness <= 6
    ) {
        alerts.push(makeAlert("good", "睡眠と体調は比較的安定しています", "極端な崩れは出ていません。", "集中力が高い日に優先項目を小さく進めてください。", 30, "stable"));
    }

    if (achievementRate !== null && achievementRate >= 70) {
        alerts.push(makeAlert("good", "睡眠予定を比較的守れています", `予定達成率は${achievementRate.toFixed(0)}%です。`, "この状態を崩さず、取り組み時間を少しずつ増やしてください。", 28, "good-achievement"));
    }

    if (studyDays >= 5) {
        alerts.push(makeAlert("good", "取り組みの継続はできています", `直近7日のうち${studyDays}日で取り組み記録があります。`, "項目配分と優先項目への着手を確認してください。", 26, "good-study"));
    }

    const seen = new Set();
    const cleaned = [];

    alerts.sort((a, b) => b.priority - a.priority).forEach(alert => {
        if (!seen.has(alert.key)) {
            cleaned.push(alert);
            seen.add(alert.key);
        }
    });

    const highOrMedium = cleaned.filter(alert => alert.level !== "good");
    const good = cleaned.filter(alert => alert.level === "good");

    if (highOrMedium.length === 0 && good.length === 0) {
        return [
            makeAlert("good", "大きな警戒サインは見つかっていません", "睡眠・体調・行動・習慣の大きな崩れは検出されていません。", "記録を続けると分析精度が上がります。", 20, "no-problem")
        ];
    }

    return [...highOrMedium.slice(0, 5), ...good.slice(0, 3)].slice(0, 8);
}

function getAutoAlertConclusion(alerts) {
    const highCount = alerts.filter(alert => alert.level === "high").length;
    const mediumCount = alerts.filter(alert => alert.level === "medium").length;
    const goodCount = alerts.filter(alert => alert.level === "good").length;

    if (highCount >= 2) {
        return "今日は回復優先です。行動量を増やすより、睡眠・疲労・眠気の悪化を止めてください。";
    }

    if (highCount === 1) {
        return "今日は慎重運用です。重い取り組みは抑え、最低限の継続と回復を優先してください。";
    }

    if (mediumCount >= 3) {
        return "生活リズムのズレが出ています。今日は予定を詰めすぎない方が安全です。";
    }

    if (mediumCount >= 1) {
        return "軽い注意点があります。取り組みは可能ですが、睡眠予定と疲労管理を優先してください。";
    }

    if (goodCount >= 1) {
        return "大きな警戒サインはありません。状態が良い時間に優先項目を進める余地があります。";
    }

    return "記録が増えると、今日の優先方針を表示します。";
}

function renderAlertItem(alert) {
    const item = document.createElement("div");
    item.className = `alert-item ${alert.level}`;

    const levelText = alert.level === "high" ? "警戒" : alert.level === "medium" ? "注意" : "良好";

    item.innerHTML = `
        <span class="alert-level ${alert.level}">${levelText}</span>
        <p class="alert-title">${alert.title}</p>
        <p class="alert-message">${alert.message}</p>
        <p class="alert-action">${alert.action}</p>
    `;

    return item;
}

function updateAutoAlerts() {
    const list = $("autoAlertList");

    if (!list) {
        return;
    }

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

// ==============================
// 項目別分析
// ==============================

function buildSubjectStats(days) {
    const records = getRecords();
    const dates = getRecentDates(days);
    const subjectMap = {};
    let totalMinutes = 0;
    let recordedDays = 0;

    dates.forEach(date => {
        const record = records[date];

        if (!record) {
            return;
        }

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

function renderSubjectAnalysisList(containerId, stats) {
    const container = $(containerId);

    if (!container) {
        return;
    }

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
                <span class="subject-analysis-name">${item.subject}</span>
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

    if (!comment) {
        return;
    }

    if (stats7.items.length === 0) {
        comment.textContent = "まだ項目別に分析できる記録がありません。まずは取り組み時間と項目を入力してください。";
        return;
    }

    if (goal.priorityItem) {
        const priority7 = stats7.items.find(item => item.subject === goal.priorityItem);
        const priority30 = stats30.items.find(item => item.subject === goal.priorityItem);

        if (!priority7 || priority7.minutes === 0) {
            comment.textContent = `優先項目「${goal.priorityItem}」が直近7日で未着手です。5〜15分だけでも触れる日を作るとよいです。`;
            return;
        }

        if (priority30 && priority30.percent < 20) {
            comment.textContent = `優先項目「${goal.priorityItem}」の直近30日比率は${priority30.percent.toFixed(0)}%です。目標に対して少なめかもしれません。`;
            return;
        }
    }

    if (top7 && top7.percent >= 70) {
        comment.textContent = `直近7日は「${top7.subject}」に偏っています。意図した偏りなら問題ありませんが、他の重要項目が止まっていないか確認してください。`;
        return;
    }

    comment.textContent = "項目別の取り組みは大きな偏りが少ない状態です。目標の優先項目に触れられているかを確認してください。";
}

// ==============================
// サマリー
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
    let sleepLongDays = 0;
    let studyTotal = 0;
    let studyDays = 0;
    let nightShiftDays = 0;
    let achievementTargetCount = 0;
    let achievedCount = 0;
    const subjectStudyTotals = {};

    dates.forEach(date => {
        const record = records[date];

        if (!record) {
            return;
        }

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
            if (sleep >= 9) sleepLongDays += 1;
        }

        if (efficiency !== null && efficiency <= 100) efficiencyValues.push(efficiency);
        if (focus !== null) focusValues.push(focus);
        if (fatigue !== null) fatigueValues.push(fatigue);
        if (sleepiness !== null) sleepinessValues.push(sleepiness);

        if (study !== null) {
            studyTotal += study;

            if (study > 0) {
                studyDays += 1;
            }

            const subject = record.mainSubject || "未選択";
            const sub = record.subSubject ? ` / ${record.subSubject}` : "";
            const key = `${subject}${sub}`;
            subjectStudyTotals[key] = (subjectStudyTotals[key] || 0) + study;
        }

        if (isNightShift(record.workType)) {
            nightShiftDays += 1;
        }

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
        sleepLongDays,
        studyTotal,
        studyDays,
        nightShiftDays,
        achievementTargetCount,
        achievedCount,
        achievementRate: achievementTargetCount === 0 ? null : achievedCount / achievementTargetCount * 100,
        subjectStudyTotals
    };
}

function updateWeeklySummary() {
    const records = getRecords();
    const dates = Object.keys(records).filter(date => {
        const diff = getDaysDiff(date);
        return diff >= 0 && diff <= 6;
    });

    const stats = buildPeriodStats(records, dates);

    setText("weeklyAvgSleep", averageText(stats.sleepValues, "時間"));
    setText("weeklyAvgEfficiency", averageText(stats.efficiencyValues, "%"));
    setText("weeklyStudyTotal", stats.studyTotal > 0 ? `${stats.studyTotal}分` : "未計算");
    setText("weeklyAvgFocus", averageText(stats.focusValues, ""));
}

function setGapSummary(id, value) {
    const element = $(id);

    if (!element) {
        return;
    }

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
    const dates = Object.keys(records).filter(date => {
        const diff = getDaysDiff(date);
        return diff >= 0 && diff <= 6;
    });

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

    if (!element) {
        return;
    }

    element.classList.remove("good", "warning", "danger");

    if (stats.achievementRate === null) {
        element.textContent = "未計算";
    } else {
        element.textContent = `${stats.achievementRate.toFixed(0)}%`;
        setSummaryClass(element, stats.achievementRate, "achievement");
    }
}

// ==============================
// 相関分析
// ==============================

function getCorrelationRangeValue() {
    return $("correlationRange") ? $("correlationRange").value : "30";
}

function getCorrelationDates() {
    const range = getCorrelationRangeValue();
    return range === "all" ? Object.keys(getRecords()).sort() : getRecentDates(Number(range));
}

function getMetricValue(record, metricKey) {
    if (!record) {
        return null;
    }

    if (metricKey === "sleepHours") return getNumberOrNull(record.sleepHours);
    if (metricKey === "sleepEfficiency") {
        const value = calculateSleepEfficiencyFromRecord(record);
        return value !== null && value <= 100 ? value : null;
    }
    if (metricKey === "mood") return getNumberOrNull(record.mood);
    if (metricKey === "sleepiness") return getNumberOrNull(record.sleepiness);
    if (metricKey === "fatigue") return getNumberOrNull(record.fatigue);
    if (metricKey === "focus") return getNumberOrNull(record.focus);
    if (metricKey === "studyTotal") return getNumberOrNull(record.studyTotal);
    if (metricKey === "bedtimeGap") return calculateAchievementFromRecord(record)?.bedtimeGap ?? null;
    if (metricKey === "wakeTimeGap") return calculateAchievementFromRecord(record)?.wakeTimeGap ?? null;
    if (metricKey === "nightShift") return isNightShift(record.workType) ? 1 : 0;

    return null;
}

function buildCorrelationPairs(records, dates, xKey, yKey, lagDays) {
    const pairs = [];

    dates.forEach(date => {
        const xDate = lagDays ? addDays(date, -lagDays) : date;
        const yDate = date;
        const x = getMetricValue(records[xDate], xKey);
        const y = getMetricValue(records[yDate], yKey);

        if (x !== null && y !== null) {
            pairs.push({ x, y, date: yDate });
        }
    });

    return pairs;
}

function calculatePearsonCorrelation(pairs) {
    if (!pairs || pairs.length < 2) {
        return null;
    }

    const n = pairs.length;
    const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / n;
    const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / n;

    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    pairs.forEach(pair => {
        const dx = pair.x - meanX;
        const dy = pair.y - meanY;
        numerator += dx * dy;
        denominatorX += dx * dx;
        denominatorY += dy * dy;
    });

    if (denominatorX === 0 || denominatorY === 0) {
        return null;
    }

    return numerator / Math.sqrt(denominatorX * denominatorY);
}

function classifyCorrelation(r, sampleSize) {
    if (sampleSize < 7 || r === null) return "insufficient";
    const abs = Math.abs(r);
    if (abs >= 0.7) return "strong";
    if (abs >= 0.5) return "middle";
    if (abs >= 0.3) return "weak";
    return "none";
}

function getCorrelationLevelLabel(level) {
    if (level === "strong") return "強い相関";
    if (level === "middle") return "中程度";
    if (level === "weak") return "弱い相関";
    if (level === "insufficient") return "データ不足";
    return "目立つ相関なし";
}

function getCorrelationClass(level) {
    if (level === "strong") return "strong";
    if (level === "middle") return "middle";
    if (level === "weak") return "weak";
    if (level === "insufficient") return "insufficient";
    return "weak";
}

function reliabilityText(sampleSize) {
    if (sampleSize < 7) return "有効データが7件未満のため、判定しません。";
    if (sampleSize < 14) return "有効データが少ないため、参考値です。";
    if (sampleSize < 30) return "ある程度の傾向として確認できます。";
    return "比較的安定した傾向として確認できます。";
}

function interpretCorrelation(config, r) {
    if (r === null) {
        return "片方または両方の値が一定で、相関を計算できません。";
    }

    if (config.customMessage) {
        return config.customMessage(r >= 0 ? "正" : "負", r);
    }

    return r >= 0
        ? `${config.xLabel}が高い日は、${config.yLabel}も高くなる傾向があります。`
        : `${config.xLabel}が高い日は、${config.yLabel}が低くなる傾向があります。`;
}

function getCorrelationConfigs() {
    return [
        { xKey: "sleepHours", yKey: "focus", xLabel: "睡眠時間", yLabel: "集中力", title: "睡眠時間 × 集中力", lagDays: 0, rankingGroup: "focus", factorLabel: "睡眠時間" },
        { xKey: "sleepEfficiency", yKey: "focus", xLabel: "睡眠効率", yLabel: "集中力", title: "睡眠効率 × 集中力", lagDays: 0, rankingGroup: "focus", factorLabel: "睡眠効率" },
        { xKey: "sleepHours", yKey: "sleepiness", xLabel: "睡眠時間", yLabel: "眠気", title: "睡眠時間 × 眠気", lagDays: 0, rankingGroup: "risk", factorLabel: "睡眠不足と眠気" },
        { xKey: "sleepHours", yKey: "fatigue", xLabel: "睡眠時間", yLabel: "疲労", title: "睡眠時間 × 疲労", lagDays: 0, rankingGroup: "risk", factorLabel: "睡眠不足と疲労" },
        { xKey: "focus", yKey: "studyTotal", xLabel: "集中力", yLabel: "取り組み時間", title: "集中力 × 取り組み時間", lagDays: 0, rankingGroup: "study", factorLabel: "集中力" },
        { xKey: "fatigue", yKey: "studyTotal", xLabel: "疲労", yLabel: "取り組み時間", title: "疲労 × 取り組み時間", lagDays: 0, rankingGroup: "study", factorLabel: "疲労" },
        { xKey: "sleepiness", yKey: "studyTotal", xLabel: "眠気", yLabel: "取り組み時間", title: "眠気 × 取り組み時間", lagDays: 0, rankingGroup: "study", factorLabel: "眠気" },
        { xKey: "bedtimeGap", yKey: "studyTotal", xLabel: "就寝ズレ", yLabel: "取り組み時間", title: "就寝ズレ × 取り組み時間", lagDays: 0, rankingGroup: "study", factorLabel: "就寝ズレ" },
        { xKey: "wakeTimeGap", yKey: "studyTotal", xLabel: "起床ズレ", yLabel: "取り組み時間", title: "起床ズレ × 取り組み時間", lagDays: 0, rankingGroup: "study", factorLabel: "起床ズレ" },
        {
            xKey: "sleepHours",
            yKey: "focus",
            xLabel: "前日の睡眠時間",
            yLabel: "翌日の集中力",
            title: "前日睡眠 × 翌日集中力",
            lagDays: 1,
            rankingGroup: "focus",
            factorLabel: "前日の睡眠"
        },
        {
            xKey: "fatigue",
            yKey: "studyTotal",
            xLabel: "前日の疲労",
            yLabel: "翌日の取り組み時間",
            title: "前日疲労 × 翌日取り組み時間",
            lagDays: 1,
            rankingGroup: "study",
            factorLabel: "前日の疲労"
        },
        {
            xKey: "nightShift",
            yKey: "sleepHours",
            xLabel: "夜勤",
            yLabel: "睡眠時間",
            title: "夜勤 × 睡眠時間",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "夜勤と睡眠"
        },
        {
            xKey: "nightShift",
            yKey: "fatigue",
            xLabel: "夜勤",
            yLabel: "疲労",
            title: "夜勤 × 疲労",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "夜勤と疲労"
        }
    ];
}

function calculateCorrelationResults() {
    const records = getRecords();
    const dates = getCorrelationDates();

    return getCorrelationConfigs().map(config => {
        const pairs = buildCorrelationPairs(records, dates, config.xKey, config.yKey, config.lagDays);
        const r = calculatePearsonCorrelation(pairs);
        const level = classifyCorrelation(r, pairs.length);

        return {
            ...config,
            pairs,
            r,
            level,
            sampleSize: pairs.length,
            absR: r === null ? 0 : Math.abs(r)
        };
    });
}

function getCorrelationInsight(results) {
    const validResults = results
        .filter(result => result.level !== "none" && result.level !== "insufficient")
        .sort((a, b) => b.absR - a.absR);

    if (validResults.length === 0) {
        return "まだ判断できる相関はありません。睡眠・体調・取り組み時間を同じ日に入力すると、分析できます。";
    }

    const top = validResults[0];
    const sign = top.r >= 0 ? "正" : "負";

    return `最も目立つのは「${top.title}」です。${getCorrelationLevelLabel(top.level)}の${sign}の関係があり、${interpretCorrelation(top, top.r)}`;
}

function renderCorrelationItem(result) {
    const item = document.createElement("div");
    const itemClass = getCorrelationClass(result.level);
    const rText = result.r === null ? "r = 未計算" : `r = ${result.r >= 0 ? "+" : ""}${result.r.toFixed(2)}`;
    const lagText = result.lagDays === 1 ? "前日→翌日" : "当日同士";

    item.className = `correlation-item ${itemClass}`;

    item.innerHTML = `
        <span class="correlation-level ${itemClass}">${getCorrelationLevelLabel(result.level)}</span>
        <span class="correlation-r">${rText}</span>
        <p class="correlation-title">${result.title}</p>
        <p class="correlation-message">${result.level === "insufficient" ? "有効データが不足しています。両方の項目が入力されている日を増やしてください。" : interpretCorrelation(result, result.r)}</p>
        <p class="correlation-note-text">有効データ：${result.sampleSize}件 / 分析：${lagText}</p>
        <p class="correlation-warning">${reliabilityText(result.sampleSize)} 相関は原因を証明するものではありません。</p>
    `;

    return item;
}

function buildRankingItems(results, groupName) {
    return results
        .filter(result => result.r !== null)
        .filter(result => result.level !== "none" && result.level !== "insufficient")
        .filter(result => result.rankingGroup === groupName)
        .sort((a, b) => b.absR - a.absR)
        .slice(0, 3);
}

function renderFactorRanking(containerId, results, emptyText) {
    const container = $(containerId);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (results.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = emptyText;
        container.appendChild(empty);
        return;
    }

    results.forEach(result => {
        const item = document.createElement("div");
        item.className = "factor-item";
        const rText = `${result.r >= 0 ? "+" : ""}${result.r.toFixed(2)}`;
        const relationText = result.r >= 0 ? "増える方向" : "減る方向";

        item.innerHTML = `
            <div>
                <span class="factor-name">${result.factorLabel}</span>
                <span class="factor-detail">${result.title} / ${getCorrelationLevelLabel(result.level)} / ${relationText}</span>
            </div>
            <span class="factor-score">r=${rText}</span>
        `;

        container.appendChild(item);
    });
}

function buildRiskRankingItems(results) {
    return results
        .filter(result => result.r !== null)
        .filter(result => result.level !== "none" && result.level !== "insufficient")
        .filter(result => {
            if (result.title.includes("疲労") && result.r > 0) return true;
            if (result.title.includes("眠気") && result.r > 0) return true;
            if (result.title.includes("取り組み時間") && result.r < 0) return true;
            if (result.title.includes("集中力") && result.r < 0) return true;
            if (result.title.includes("夜勤") && result.r > 0) return true;
            return false;
        })
        .sort((a, b) => b.absR - a.absR)
        .slice(0, 3);
}

function updateCorrelationAnalysis() {
    const list = $("correlationList");

    if (!list) {
        return;
    }

    const results = calculateCorrelationResults();

    const displayResults = results
        .filter(result => result.level !== "none")
        .sort((a, b) => {
            if (a.level === "insufficient" && b.level !== "insufficient") return 1;
            if (a.level !== "insufficient" && b.level === "insufficient") return -1;
            return b.absR - a.absR;
        })
        .slice(0, 8);

    const validResults = results.filter(result => result.level !== "none" && result.level !== "insufficient");
    const top = validResults.slice().sort((a, b) => b.absR - a.absR)[0];

    setText("correlationValidCount", `${validResults.length}件`);

    if ($("correlationTopStrength")) {
        if (top) {
            $("correlationTopStrength").textContent = `${top.r >= 0 ? "+" : ""}${top.r.toFixed(2)}`;
            $("correlationTopStrength").className = top.absR >= 0.7
                ? "summary-value good"
                : top.absR >= 0.5
                    ? "summary-value warning"
                    : "summary-value";
        } else {
            $("correlationTopStrength").textContent = "未計算";
            $("correlationTopStrength").className = "summary-value";
        }
    }

    setText("correlationInsight", getCorrelationInsight(results));

    renderFactorRanking("studyFactorRanking", buildRankingItems(results, "study"), "取り組み時間と関係が見える項目はまだありません。");
    renderFactorRanking("focusFactorRanking", buildRankingItems(results, "focus"), "集中力と関係が見える項目はまだありません。");
    renderFactorRanking("riskFactorRanking", buildRiskRankingItems(results), "悪化要因候補はまだ見つかっていません。");

    list.innerHTML = "";

    if (displayResults.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "目立つ相関はまだ見つかっていません。記録が増えると分析精度が上がります。";
        list.appendChild(empty);
        return;
    }

    displayResults.forEach(result => list.appendChild(renderCorrelationItem(result)));
}

// ==============================
// グラフ
// ==============================

function getChartRangeValue() {
    return $("chartRange") ? $("chartRange").value : "30";
}

function getChartDates() {
    const records = getRecords();
    const range = getChartRangeValue();

    if (range === "all") {
        return Object.keys(records).sort();
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

        if (!record) {
            return null;
        }

        return getNumberOrNull(record[key]);
    });
}

function buildGapSeries(dates, gapType) {
    const records = getRecords();

    return dates.map(date => {
        const record = records[date];

        if (!record) {
            return null;
        }

        const achievement = calculateAchievementFromRecord(record);

        if (!achievement) {
            return null;
        }

        return gapType === "bedtime" ? achievement.bedtimeGap : achievement.wakeTimeGap;
    });
}

function resizeCanvasForDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0) {
        return;
    }

    const ratio = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(rect.width);
    const displayHeight = Math.floor(displayWidth * 0.4);

    canvas.width = displayWidth * ratio;
    canvas.height = displayHeight * ratio;

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawEmptyChart(canvasId, message) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    resizeCanvasForDisplay(canvas);

    const ctx = canvas.getContext("2d");
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
}

function hasVisibleData(datasets) {
    return datasets.some(dataset => {
        return dataset.values.some(value => value !== null && value !== undefined && !Number.isNaN(value));
    });
}

function orderDatasetsForHighlight(datasets, activeKey) {
    if (!activeKey) {
        return datasets;
    }

    const inactive = datasets.filter(dataset => dataset.key !== activeKey);
    const active = datasets.filter(dataset => dataset.key === activeKey);

    return [...inactive, ...active];
}

function drawLineChart(config) {
    const canvas = $(config.canvasId);

    if (!canvas) {
        return;
    }

    resizeCanvasForDisplay(canvas);

    const ctx = canvas.getContext("2d");
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    const padding = { top: 24, right: 16, bottom: 42, left: 44 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const labels = config.labels || [];
    const datasets = config.datasets || [];

    if (labels.length === 0 || !hasVisibleData(datasets)) {
        drawEmptyChart(config.canvasId, "表示できるデータがありません");
        return;
    }

    const allValues = [];

    datasets.forEach(dataset => {
        dataset.values.forEach(value => {
            if (value !== null && value !== undefined && !Number.isNaN(value)) {
                allValues.push(value);
            }
        });
    });

    let minValue = config.minValue !== undefined ? config.minValue : Math.min(...allValues);
    let maxValue = config.maxValue !== undefined ? config.maxValue : Math.max(...allValues);

    if (minValue === maxValue) {
        minValue -= 1;
        maxValue += 1;
    }

    if (config.includeZero) {
        minValue = Math.min(0, minValue);
        maxValue = Math.max(0, maxValue);
    }

    const valueRange = maxValue - minValue;

    function xForIndex(index) {
        if (labels.length === 1) {
            return padding.left + chartWidth / 2;
        }

        return padding.left + chartWidth * index / (labels.length - 1);
    }

    function yForValue(value) {
        return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    }

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + chartHeight * i / 4;

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        const value = maxValue - valueRange * i / 4;
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(config.valueDecimals ?? 0), padding.left - 6, y + 4);
    }

    if (config.includeZero && minValue < 0 && maxValue > 0) {
        const zeroY = yForValue(0);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + chartWidth, zeroY);
        ctx.stroke();
    }

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    const labelStep = labels.length <= 8 ? 1 : Math.ceil(labels.length / 6);

    labels.forEach((label, index) => {
        if (index % labelStep !== 0 && index !== labels.length - 1) {
            return;
        }

        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, xForIndex(index), padding.top + chartHeight + 18);
    });

    const drawDatasets = orderDatasetsForHighlight(datasets, config.activeKey);

    drawDatasets.forEach(dataset => {
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
            if (value === null || value === undefined || Number.isNaN(value)) {
                return;
            }

            const radius = isActive ? 5 : isInactive ? 2 : 3;

            ctx.beginPath();
            ctx.arc(xForIndex(index), yForValue(value), radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    });

    if (datasets.length > 1 && config.showLegend !== false) {
        let legendX = padding.left;
        const legendY = 14;

        datasets.forEach(dataset => {
            const isInactive = config.activeKey && dataset.key !== config.activeKey;

            ctx.globalAlpha = isInactive ? 0.35 : 1;
            ctx.fillStyle = dataset.color;
            ctx.fillRect(legendX, legendY - 8, 10, 10);

            ctx.fillStyle = "#334155";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(dataset.label, legendX + 14, legendY);

            ctx.globalAlpha = 1;
            legendX += dataset.label.length * 12 + 42;
        });
    }
}

function getConditionDatasetLabel(key) {
    if (key === "mood") return "気分";
    if (key === "sleepiness") return "眠気";
    if (key === "fatigue") return "疲労";
    if (key === "focus") return "集中力";
    return "なし";
}

function updateConditionChartButtons() {
    const buttons = document.querySelectorAll(".condition-chart-button");
    const status = $("conditionChartFocusStatus");

    buttons.forEach(button => {
        button.classList.toggle("active", button.dataset.conditionKey === activeConditionChartKey);
    });

    if (status) {
        status.textContent = activeConditionChartKey
            ? `現在の強調：${getConditionDatasetLabel(activeConditionChartKey)}`
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
        updateConditionChartButtons();
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
            {
                key: "sleepHours",
                label: "実睡眠",
                color: "#2563eb",
                values: buildSeriesFromRecords(dates, "sleepHours")
            }
        ]
    });

    drawLineChart({
        canvasId: "studyChart",
        labels,
        minValue: 0,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            {
                key: "studyTotal",
                label: "取り組み時間",
                color: "#16a34a",
                values: buildSeriesFromRecords(dates, "studyTotal")
            }
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
        showLegend: false,
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

        if (!container) {
            return;
        }

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

                if (!input) {
                    return;
                }

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

        if (display) {
            display.textContent = value ? `${value} / 10` : "未入力";
        }

        buttons.forEach(button => {
            button.classList.toggle("selected", button.dataset.value === value);
        });
    });
}

// ==============================
// カレンダー・履歴
// ==============================

function getRecordCompleteness(record, date) {
    if (!record) {
        return "none";
    }

    const hasActualSleep = Boolean(record.bedtime || record.wakeTime || record.sleepHours || record.awakeCount);
    const hasCondition = Boolean(record.mood || record.sleepiness || record.fatigue || record.focus);
    const hasStudy = Boolean(record.studyTotal || record.mainSubject || record.subSubject);
    const hasWork = Boolean(record.workType);
    const hasMemo = Boolean(record.memo && record.memo.trim() !== "");
    const hasHabit = date ? getHabitAchievementCount(date) > 0 : false;

    const categoryCount = [hasActualSleep, hasCondition, hasStudy, hasWork, hasMemo, hasHabit].filter(Boolean).length;

    if (categoryCount === 0) return "none";
    if (categoryCount >= 2) return "full";
    return "partial";
}

function getCompletenessLabel(completeness) {
    if (completeness === "full") return "十分";
    if (completeness === "partial") return "一部";
    return "なし";
}

function renderRecordCalendar() {
    const calendar = $("recordCalendar");

    if (!calendar) {
        return;
    }

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
            if ($("recordDate")) {
                $("recordDate").value = date;
            }

            loadRecord(date);
        });

        calendar.appendChild(button);
    }
}

function filterDates(dates) {
    if (historyFilter === "all") {
        return dates;
    }

    const limit = Number(historyFilter);

    return dates.filter(date => {
        const diff = getDaysDiff(date);
        return diff >= 0 && diff <= limit - 1;
    });
}

function renderHistory() {
    const historyList = $("historyList");

    if (!historyList) {
        return;
    }

    const records = getRecords();
    const allDates = Object.keys(records).sort().reverse();
    const dates = filterDates(allDates);

    historyList.innerHTML = "";

    if (allDates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "まだ記録がありません";
        historyList.appendChild(empty);
        return;
    }

    if (dates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "この期間の記録はありません";
        historyList.appendChild(empty);
        return;
    }

    dates.forEach(date => {
        const record = records[date];
        const completeness = getRecordCompleteness(record, date);
        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const achievement = calculateAchievementFromRecord(record);
        const habitCount = getHabitAchievementCount(date);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `history-item ${completeness}`;

        if (date === currentDate) {
            button.classList.add("active");
        }

        const sleepText = record.sleepHours ? `実睡眠 ${record.sleepHours}h` : "実睡眠 未入力";
        const efficiencyText = efficiency !== null ? `効率 ${efficiency.toFixed(1)}%` : "効率 未計算";
        const studyText = record.studyTotal ? `取り組み ${record.studyTotal}分` : "取り組み 未入力";
        const subjectText = record.mainSubject ? `項目 ${record.mainSubject}${record.subSubject ? " / " + record.subSubject : ""}` : "項目 未入力";
        const workText = record.workType ? `勤務・予定 ${record.workType}` : "勤務・予定 未入力";
        const conditionText = record.mood || record.sleepiness || record.fatigue || record.focus
            ? `体調 気分${record.mood || "-"} 眠気${record.sleepiness || "-"} 疲労${record.fatigue || "-"} 集中${record.focus || "-"}`
            : "体調 未入力";
        const planText = record.plannedBedtime && record.plannedWakeTime
            ? `予定 ${record.plannedBedtime}-${formatTimeWithNextDay(record.plannedBedtime, record.plannedWakeTime)}`
            : "予定 未入力";
        const bedtimeGapText = achievement && achievement.bedtimeGap !== null ? `就寝ズレ ${formatGapMinutes(achievement.bedtimeGap)}` : "就寝ズレ 未計算";
        const wakeGapText = achievement && achievement.wakeTimeGap !== null ? `起床ズレ ${formatGapMinutes(achievement.wakeTimeGap)}` : "起床ズレ 未計算";
        const achievementClass = achievement && achievement.canJudgeAchievement && achievement.achieved ? "good" : achievement && achievement.canJudgeAchievement ? "warning" : "";
        const achievementText = achievement && achievement.canJudgeAchievement && achievement.achieved ? "予定達成" : achievement && achievement.canJudgeAchievement ? "予定未達" : "予定判定 未計算";

        button.innerHTML = `
            <span class="history-date">${date}　${getCompletenessLabel(completeness)}記録</span>
            <span class="history-detail">${planText}</span>
            <span class="history-detail">${sleepText}　${efficiencyText}</span>
            <span class="history-detail ${achievementClass}">${bedtimeGapText}　${wakeGapText}　${achievementText}</span>
            <span class="history-detail">${conditionText}</span>
            <span class="history-detail">${studyText}　${subjectText}　${workText}</span>
            <span class="history-detail">継続項目 達成${habitCount}件</span>
        `;

        button.addEventListener("click", () => {
            if ($("recordDate")) {
                $("recordDate").value = date;
            }

            loadRecord(date);
        });

        historyList.appendChild(button);
    });
}

// ==============================
// AI相談文
// ==============================

function buildPeriodSummaryText(title, dates, stats) {
    const firstDate = dates[0] || "不明";
    const lastDate = dates[dates.length - 1] || "不明";
    const achievementText = stats.achievementTargetCount === 0
        ? "未計算"
        : `${stats.achievedCount}/${stats.achievementTargetCount}日（${Math.round(stats.achievementRate)}%）`;

    return [
        `【${title}】`,
        `対象期間：${firstDate} 〜 ${lastDate}`,
        `記録日数：${stats.recordDays}/${stats.targetDays}日`,
        `平均実睡眠：${averageText(stats.sleepValues, "時間")}`,
        `平均睡眠効率：${averageText(stats.efficiencyValues, "%")}`,
        `睡眠不足日数（6時間未満）：${stats.sleepShortDays}日`,
        `寝すぎ日数（9時間以上）：${stats.sleepLongDays}日`,
        `平均集中力：${averageText(stats.focusValues, "")}`,
        `平均疲労：${averageText(stats.fatigueValues, "")}`,
        `平均眠気：${averageText(stats.sleepinessValues, "")}`,
        `合計取り組み時間：${stats.studyTotal}分（${(stats.studyTotal / 60).toFixed(1)}時間）`,
        `取り組んだ日数：${stats.studyDays}日`,
        `夜勤回数：${stats.nightShiftDays}回`,
        `平均就寝ズレ：${formatGapMinutes(averageNumber(stats.bedtimeGaps))}`,
        `平均起床ズレ：${formatGapMinutes(averageNumber(stats.wakeTimeGaps))}`,
        `予定達成率：${achievementText}`
    ].join("\n");
}

function buildWeeklySummaryText(records) {
    const dates = getRecentDates(7);
    const stats = buildPeriodStats(records, dates);
    return buildPeriodSummaryText("直近7日の要約", dates, stats);
}

function buildThirtyDaySummaryText(records) {
    const dates = getRecentDates(30);
    const stats = buildPeriodStats(records, dates);
    return buildPeriodSummaryText("直近30日の要約", dates, stats);
}

function buildMonthlySummaryText(records) {
    const monthMap = {};

    Object.keys(records).sort().forEach(date => {
        const monthKey = date.slice(0, 7);

        if (!monthMap[monthKey]) {
            monthMap[monthKey] = [];
        }

        monthMap[monthKey].push(date);
    });

    const monthKeys = Object.keys(monthMap).sort();

    if (monthKeys.length === 0) {
        return "【月別要約】\n保存されている記録がありません。";
    }

    const lines = ["【月別要約】", "※ 最大で直近12か月分を表示します。"];

    monthKeys.slice(-12).forEach(monthKey => {
        const dates = monthMap[monthKey];
        const stats = buildPeriodStats(records, dates);
        const achievementText = stats.achievementTargetCount === 0 ? "未計算" : `${Math.round(stats.achievementRate)}%`;
        const studyHoursText = `${(stats.studyTotal / 60).toFixed(1)}時間`;

        lines.push(`${monthKey}：記録${stats.recordDays}日、平均睡眠${averageText(stats.sleepValues, "時間")}、取り組み${studyHoursText}、取り組み日${stats.studyDays}日、夜勤${stats.nightShiftDays}回、平均集中${averageText(stats.focusValues, "")}、予定達成率${achievementText}`);
    });

    return lines.join("\n");
}

function buildSubjectSummaryText(records, days) {
    const dates = getRecentDates(days);
    const stats = buildPeriodStats(records, dates);
    const entries = Object.entries(stats.subjectStudyTotals)
        .filter(([, minutes]) => minutes > 0)
        .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
        return `【直近${days}日の項目別取り組み時間】\n取り組み時間の記録がありません。`;
    }

    const lines = [`【直近${days}日の項目別取り組み時間】`];

    entries.forEach(([subject, minutes]) => {
        lines.push(`${subject}：${minutes}分（${(minutes / 60).toFixed(1)}時間）`);
    });

    return lines.join("\n");
}

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

function buildHabitSummaryText(days) {
    const habits = getHabits();

    if (habits.length === 0) {
        return `【直近${days}日の継続項目】\n継続項目がありません。`;
    }

    const date = $("recordDate")?.value || getTodayString();
    const lines = [`【直近${days}日の継続項目】`];

    habits.forEach(habit => {
        const rate = getHabitAchievementRate(habit.id, days);
        const streak = getHabitStreakUntil(date, habit.id);
        const typeText = habit.type === "avoid" ? "回避型" : "実行型";

        lines.push(`${habit.name}（${typeText}）：現在${streak}日継続、${days}日達成率${rate.rate.toFixed(0)}%`);
    });

    return lines.join("\n");
}

function buildRecentDailyLines(records) {
    const dates = getRecentDates(7);
    const lines = [];

    dates.forEach(date => {
        const record = records[date];

        if (!record) {
            lines.push(`${date}：記録なし`);
            return;
        }

        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const achievement = calculateAchievementFromRecord(record);
        const habitCount = getHabitAchievementCount(date);

        const efficiencyText = efficiency === null ? "未計算" : efficiency > 100 ? `${efficiency.toFixed(1)}%（要確認）` : `${efficiency.toFixed(1)}%`;
        const achievementText = achievement && achievement.canJudgeAchievement ? achievement.achieved ? "予定達成" : "予定未達" : "予定判定なし";

        lines.push(`${date}：睡眠${valueOrDash(record.sleepHours)}h、効率${efficiencyText}、気分${valueOrDash(record.mood)}、眠気${valueOrDash(record.sleepiness)}、疲労${valueOrDash(record.fatigue)}、集中${valueOrDash(record.focus)}、取り組み${valueOrDash(record.studyTotal)}分、項目${valueOrDash(record.mainSubject)}${record.subSubject ? " / " + record.subSubject : ""}、習慣達成${habitCount}件、勤務・予定${valueOrDash(record.workType)}、${achievementText}`);
    });

    return ["【直近7日の各日データ】", ...lines].join("\n");
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

function buildCorrelationSummaryText() {
    const results = calculateCorrelationResults();
    const validResults = results
        .filter(result => result.level !== "none" && result.level !== "insufficient")
        .sort((a, b) => b.absR - a.absR)
        .slice(0, 5);

    if (validResults.length === 0) {
        return "【相関分析】\n有効な相関はまだ見つかっていません。記録が増えると分析精度が上がります。";
    }

    return [
        "【相関分析】",
        getCorrelationInsight(results),
        ...validResults.map(result => {
            const level = getCorrelationLevelLabel(result.level);
            const rText = result.r === null ? "未計算" : `${result.r >= 0 ? "+" : ""}${result.r.toFixed(2)}`;
            return `・${level}：${result.title}（r=${rText}, 有効データ${result.sampleSize}件）\n  ${interpretCorrelation(result, result.r)}`;
        }),
        "※ 相関は原因を証明するものではなく、確認候補です。"
    ].join("\n");
}

function buildCurrentDayText(date, record) {
    const efficiency = calculateSleepEfficiencyFromRecord(record);
    const achievement = calculateAchievementFromRecord(record);
    const plannedTimeInBed = calculateTimeInBedHours(record.plannedBedtime, record.plannedWakeTime);
    const actualTimeInBed = calculateTimeInBedHours(record.bedtime, record.wakeTime);

    return [
        "【現在選択中の日付】",
        `日付：${date}`,
        "",
        "【睡眠】",
        `予定就寝：${valueOrDash(record.plannedBedtime)}`,
        `予定起床：${formatTimeWithNextDay(record.plannedBedtime, record.plannedWakeTime)}`,
        `実際就寝：${valueOrDash(record.bedtime)}`,
        `実際起床：${formatTimeWithNextDay(record.bedtime, record.wakeTime)}`,
        `予定在床時間：${plannedTimeInBed === null ? "未計算" : plannedTimeInBed.toFixed(1) + "時間"}`,
        `実際在床時間：${actualTimeInBed === null ? "未計算" : actualTimeInBed.toFixed(1) + "時間"}`,
        `実睡眠時間：${valueOrDash(record.sleepHours)}時間`,
        `覚醒回数：${valueOrDash(record.awakeCount)}`,
        `睡眠効率：${efficiency === null ? "未計算" : efficiency.toFixed(1) + "%"}`,
        `就寝ズレ：${achievement ? formatGapMinutes(achievement.bedtimeGap) : "未計算"}`,
        `起床ズレ：${achievement ? formatGapMinutes(achievement.wakeTimeGap) : "未計算"}`,
        `在床差：${achievement ? formatGapMinutes(achievement.timeInBedGap) : "未計算"}`,
        `予定達成判定：${achievement && achievement.canJudgeAchievement ? achievement.achieved ? "予定達成" : "予定未達" : "未計算"}`,
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
        "【今日の継続項目】",
        buildTodayHabitText(date),
        "",
        "【メモ】",
        valueOrDash(record.memo)
    ].join("\n");
}

function buildTodayHabitText(date) {
    const habits = getHabits();

    if (habits.length === 0) {
        return "継続項目なし";
    }

    return habits.map(habit => {
        const result = getHabitResult(date, habit.id);
        const resultText = result === true ? "達成" : result === false ? "未達成・途切れた" : "未記録";
        return `${habit.name}：${resultText}`;
    }).join("\n");
}

function buildCommonOpening() {
    return [
        "以下は、Life Growth Analyzerから出力した生活記録データです。",
        "睡眠、体調、仕事・予定、学習・自己改善、継続習慣を両立しながら、現在の目標に近づきたいです。",
        "極端な根性論ではなく、現実的に継続できる提案をしてください。"
    ].join("\n");
}

function buildAiText(type, date, record, records) {
    const common = [
        buildCommonOpening(),
        "",
        buildGoalText(),
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildWeeklySummaryText(records),
        "",
        buildHabitSummaryText(7),
        "",
        buildSubjectSummaryText(records, 30),
        "",
        buildCorrelationSummaryText()
    ];

    if (type === "thirty") {
        return [
            ...common,
            "",
            buildThirtyDaySummaryText(records),
            "",
            buildHabitSummaryText(30),
            "",
            buildRecentDailyLines(records),
            "",
            "【相談したいこと】",
            "1. 直近30日の生活リズムの問題点は何か。",
            "2. 睡眠・疲労・取り組み・習慣のどこを優先的に直すべきか。",
            "3. 現在の目標に対して、取り組み項目の配分は妥当か。",
            "4. 継続項目を無理なく維持するにはどうすべきか。"
        ].join("\n");
    }

    if (type === "long") {
        return [
            ...common,
            "",
            buildThirtyDaySummaryText(records),
            "",
            buildMonthlySummaryText(records),
            "",
            buildHabitSummaryText(30),
            "",
            "【相談したいこと】",
            "1. 月別に見て、睡眠・取り組み・習慣は改善しているか。",
            "2. 長期的に最も足を引っ張っている要因は何か。",
            "3. 今後1か月で最優先に改善すべき行動は何か。",
            "4. 無理なく継続するための月間目標をどう設定すべきか。"
        ].join("\n");
    }

    if (type === "goal") {
        return [
            ...common,
            "",
            buildThirtyDaySummaryText(records),
            "",
            buildHabitSummaryText(30),
            "",
            buildMonthlySummaryText(records),
            "",
            "【相談したいこと】",
            "1. 現在の目標に対して、1日の最低ラインと標準ラインは妥当か。",
            "2. 優先項目に触れる頻度をどう設計すべきか。",
            "3. 睡眠と体調を崩さずに取り組み時間を増やす方法は何か。",
            "4. 継続項目を含めた直近1か月の行動計画を、最低ライン・標準ライン・余力がある日の3段階で提案してほしい。"
        ].join("\n");
    }

    return [
        ...common,
        "",
        buildRecentDailyLines(records),
        "",
        "【相談したいこと】",
        "1. 今日の取り組み量は増やすべきか、抑えるべきか。",
        "2. 継続項目をどう扱うべきか。",
        "3. 勤務・予定の前後に何を優先すべきか。",
        "4. 明日以降に崩れないための注意点は何か。"
    ].join("\n");
}

function getSelectedConsultType() {
    const selected = document.querySelector('input[name="consultType"]:checked');
    return selected ? selected.value : "today";
}

function getConsultTypeLabel(type) {
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
        $("aiConsultText").value = buildAiText(type, date, record, records);
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
// 削除・バックアップ
// ==============================

function updateDeleteButton() {
    const button = $("deleteRecordButton");
    const date = $("recordDate")?.value;

    if (!button || !date) {
        return;
    }

    button.disabled = !getRecords()[date];
}

function deleteCurrentRecord() {
    const date = $("recordDate")?.value;

    if (!date) {
        return;
    }

    const records = getRecords();

    if (!records[date]) {
        updateSaveStatus(`削除する記録がありません：${date}`, false);
        return;
    }

    if (!window.confirm(`${date} の記録を削除しますか？`)) {
        return;
    }

    delete records[date];
    setRecords(records);

    clearForm();
    applyDefaultPlanToForm();

    currentDate = date;
    localStorage.setItem(LAST_DATE_KEY, date);

    updateAllCalculatedDisplays();
    updateSaveStatus(`削除しました：${date}`, false);
    updateAfterDataChange();
}

function exportData() {
    const backupData = {
        appName: "Life Growth Analyzer",
        version: "6.0",
        exportedAt: new Date().toISOString(),
        settings: getSettings(),
        subjects: getSubjectConfigs(),
        goal: getGoal(),
        habits: getHabits(),
        habitRecords: getHabitRecords(),
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
    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = event => {
        try {
            const imported = JSON.parse(event.target.result);
            const records = imported.records && typeof imported.records === "object" ? imported.records : imported;

            if (!records || typeof records !== "object" || Array.isArray(records)) {
                window.alert("復元できません。JSONの形式が正しくありません。");
                return;
            }

            const count = Object.keys(records).length;

            if (!window.confirm(`JSONファイルから ${count} 件の記録を復元します。\n現在のデータは上書きされます。\n実行しますか？`)) {
                return;
            }

            setRecords(records);

            if (imported.settings) setSettings(imported.settings);
            if (imported.subjects) setSubjectConfigs(imported.subjects);
            if (imported.goal) setGoal(imported.goal);
            if (imported.habits) setHabits(imported.habits);
            if (imported.habitRecords) setHabitRecords(imported.habitRecords);

            loadSettingsToForm();
            loadSubjectsToUI();
            loadGoalToForm();
            renderHabitSettingsList();

            const dates = Object.keys(getRecords()).sort().reverse();
            const nextDate = dates[0] || getTodayString();

            if ($("recordDate")) {
                $("recordDate").value = nextDate;
            }

            loadRecord(nextDate);

            updateSaveStatus(`復元しました：${count}件`, false);
            window.alert("復元が完了しました。");
        } catch (error) {
            console.error(error);
            window.alert("復元に失敗しました。JSONファイルを確認してください。");
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

        if (!element) {
            return;
        }

        element.addEventListener("input", () => {
            updateRatingDisplays();
            saveCurrentRecord();
        });

        element.addEventListener("change", () => {
            if (id === "mainSubject") {
                updateSubSubjectSelectOptions("");
            }

            updateRatingDisplays();
            saveCurrentRecord();
        });
    });
}

function setupDateEvent() {
    if ($("recordDate")) {
        $("recordDate").addEventListener("change", () => {
            const date = $("recordDate").value;

            if (date) {
                loadRecord(date);
            }
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
    if ($("chartRange")) {
        $("chartRange").addEventListener("change", updateCharts);
    }

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
    if ($("correlationRange")) {
        $("correlationRange").addEventListener("change", updateCorrelationAnalysis);
    }
}

function setupBackupEvents() {
    if ($("exportButton")) {
        $("exportButton").addEventListener("click", exportData);
    }

    if ($("importFile")) {
        $("importFile").addEventListener("change", event => {
            importDataFromFile(event.target.files[0]);
            event.target.value = "";
        });
    }
}

function setupAiTextEvents() {
    if ($("generateAiTextButton")) {
        $("generateAiTextButton").addEventListener("click", generateAiConsultText);
    }

    if ($("copyAiTextButton")) {
        $("copyAiTextButton").addEventListener("click", copyAiConsultText);
    }

    document.querySelectorAll('input[name="consultType"]').forEach(input => {
        input.addEventListener("change", () => {
            if ($("aiConsultText")) {
                $("aiConsultText").value = "";
            }

            setText("copyStatus", `相談タイプを変更しました：${getConsultTypeLabel(getSelectedConsultType())}`);
        });
    });
}

function setupSettingsEvents() {
    if ($("saveSettingsButton")) {
        $("saveSettingsButton").addEventListener("click", saveSettingsFromForm);
    }
}

function setupGoalEvents() {
    if ($("saveGoalButton")) {
        $("saveGoalButton").addEventListener("click", saveGoalFromForm);
    }
}

function setupDeleteEvent() {
    if ($("deleteRecordButton")) {
        $("deleteRecordButton").addEventListener("click", deleteCurrentRecord);
    }
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

    loadSettingsToForm();
    loadSubjectsToUI();
    loadGoalToForm();
    renderHabitSettingsList();
    setupRatingButtons();

    const lastDate = localStorage.getItem(LAST_DATE_KEY);
    const startDate = lastDate || getTodayString();

    dateElement.value = startDate;
    currentDate = startDate;

    loadRecord(startDate);

    setupInputEvents();
    setupDateEvent();
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

    updateRatingDisplays();
    updateTodayAdvice();
    renderRecordCalendar();
    updateDeleteButton();
    updateWeeklySummary();
    updateAchievementSummary();
    updateSettingsStatus();
    updateGoalStatus();
    updateCharts();
    updateAutoAlerts();
    updateCorrelationAnalysis();
    updateSubjectAnalysis();
    renderTodayHabitList();
    updateHabitAnalysis();

    console.log("初期化完了");
});