// CPA Life Analyzer v4.5

console.log("CPA Life Analyzer v4.5 起動");

const STORAGE_KEY = "CPA_LIFE_ANALYZER_RECORDS_V2";
const LAST_DATE_KEY = "CPA_LIFE_ANALYZER_LAST_DATE_V2";
const SETTINGS_KEY = "CPA_LIFE_ANALYZER_SETTINGS_V2";

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
// 日付・時刻
// ==============================

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
    const parts = dateText.split("-").map(Number);

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
    const parts = dateText.split("-");

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

// ==============================
// 保存・設定
// ==============================

function getRecords() {
    const text = localStorage.getItem(STORAGE_KEY);

    if (!text) {
        return {};
    }

    try {
        const records = JSON.parse(text);

        if (!records || typeof records !== "object" || Array.isArray(records)) {
            return {};
        }

        return records;
    } catch (error) {
        console.error("データの読み込みに失敗しました", error);
        return {};
    }
}

function setRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getSettings() {
    const text = localStorage.getItem(SETTINGS_KEY);

    if (!text) {
        return {
            defaultPlannedBedtime: "",
            defaultPlannedWakeTime: ""
        };
    }

    try {
        const settings = JSON.parse(text);

        return {
            defaultPlannedBedtime: settings.defaultPlannedBedtime || "",
            defaultPlannedWakeTime: settings.defaultPlannedWakeTime || ""
        };
    } catch (error) {
        console.error("設定の読み込みに失敗しました", error);

        return {
            defaultPlannedBedtime: "",
            defaultPlannedWakeTime: ""
        };
    }
}

function setSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettingsToForm() {
    const settings = getSettings();

    const defaultBedtime = document.getElementById("defaultPlannedBedtime");
    const defaultWakeTime = document.getElementById("defaultPlannedWakeTime");

    if (defaultBedtime) {
        defaultBedtime.value = settings.defaultPlannedBedtime;
    }

    if (defaultWakeTime) {
        defaultWakeTime.value = settings.defaultPlannedWakeTime;
    }

    updateSettingsStatus();
}

function saveSettingsFromForm() {
    const defaultBedtime = document.getElementById("defaultPlannedBedtime")?.value || "";
    const defaultWakeTime = document.getElementById("defaultPlannedWakeTime")?.value || "";

    const settings = {
        defaultPlannedBedtime: defaultBedtime,
        defaultPlannedWakeTime: defaultWakeTime
    };

    setSettings(settings);
    updateSettingsStatus();

    const plannedBedtime = document.getElementById("plannedBedtime");
    const plannedWakeTime = document.getElementById("plannedWakeTime");

    if (plannedBedtime && !plannedBedtime.value) {
        plannedBedtime.value = defaultBedtime;
    }

    if (plannedWakeTime && !plannedWakeTime.value) {
        plannedWakeTime.value = defaultWakeTime;
    }

    updateAllCalculatedDisplays();
    saveCurrentRecord();

    window.alert("基本睡眠予定を保存しました。新しい日付ではこの予定が自動入力されます。");
}

function updateSettingsStatus() {
    const status = document.getElementById("settingsStatus");
    const settings = getSettings();

    if (!status) {
        return;
    }

    if (settings.defaultPlannedBedtime && settings.defaultPlannedWakeTime) {
        status.textContent = `設定中：${settings.defaultPlannedBedtime} 〜 ${settings.defaultPlannedWakeTime}`;
    } else {
        status.textContent = "未設定";
    }
}

function applyDefaultPlanToForm() {
    const settings = getSettings();

    const plannedBedtime = document.getElementById("plannedBedtime");
    const plannedWakeTime = document.getElementById("plannedWakeTime");

    if (plannedBedtime) {
        plannedBedtime.value = settings.defaultPlannedBedtime;
    }

    if (plannedWakeTime) {
        plannedWakeTime.value = settings.defaultPlannedWakeTime;
    }
}

// ==============================
// フォーム
// ==============================

function getFormData() {
    const data = {};

    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            data[id] = element.value;
        }
    });

    return data;
}

function setFormData(data) {
    const settings = getSettings();

    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.value = data[id] ?? "";
        }
    });

    if (!data.plannedBedtime) {
        const plannedBedtime = document.getElementById("plannedBedtime");

        if (plannedBedtime) {
            plannedBedtime.value = settings.defaultPlannedBedtime;
        }
    }

    if (!data.plannedWakeTime) {
        const plannedWakeTime = document.getElementById("plannedWakeTime");

        if (plannedWakeTime) {
            plannedWakeTime.value = settings.defaultPlannedWakeTime;
        }
    }

    updateRatingDisplays();
    updateAllCalculatedDisplays();
}

function clearForm() {
    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.value = "";
        }
    });

    updateRatingDisplays();
    updateAllCalculatedDisplays();
}

function saveCurrentRecord() {
    const dateElement = document.getElementById("recordDate");

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

    if (warnings.length > 0) {
        updateSaveStatus(`保存しました：${date} ${getCurrentTimeString()}　※確認あり`, true);
    } else {
        updateSaveStatus(`保存しました：${date} ${getCurrentTimeString()}`, false);
    }

    updateAfterDataChange();

    console.log("保存しました", date, records[date]);
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
}

function updateSaveStatus(message, hasWarning) {
    const status = document.getElementById("saveStatus");
    const statusCard = document.querySelector(".status-card");

    if (status) {
        status.textContent = message;
    }

    if (statusCard) {
        if (hasWarning) {
            statusCard.classList.add("warning");
        } else {
            statusCard.classList.remove("warning");
        }
    }
}

// ==============================
// 計算
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

    const roundedMinutes = Math.round(minutes);

    if (roundedMinutes === 0) {
        return "±0分";
    }

    const sign = roundedMinutes > 0 ? "+" : "-";
    const abs = Math.abs(roundedMinutes);
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

    const hasRequiredGaps = bedtimeGap !== null && wakeTimeGap !== null;

    const achieved = hasRequiredGaps &&
        Math.abs(bedtimeGap) <= 30 &&
        Math.abs(wakeTimeGap) <= 30;

    return {
        bedtimeGap,
        wakeTimeGap,
        timeInBedGap,
        achieved,
        canJudgeAchievement: hasRequiredGaps
    };
}

function calculateSleepEfficiency() {
    return calculateSleepEfficiencyFromRecord(getFormData());
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
    if (!values || values.length === 0) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
}

function averageText(values, unit) {
    if (!values || values.length === 0) {
        return "未計算";
    }

    const average = averageNumber(values);

    if (unit === "%") {
        return `${average.toFixed(1)}%`;
    }

    if (unit === "時間") {
        return `${average.toFixed(1)}時間`;
    }

    return average.toFixed(1);
}

function setText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

function setSummaryClass(element, value, type) {
    if (!element) {
        return;
    }

    element.classList.remove("good", "warning", "danger");

    if (value === null || value === undefined || Number.isNaN(value)) {
        return;
    }

    if (type === "sleepEfficiency") {
        if (value > 100) {
            element.classList.add("danger");
        } else if (value < 70) {
            element.classList.add("warning");
        } else {
            element.classList.add("good");
        }
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
// 睡眠表示
// ==============================

function updateSleepSummary() {
    const plannedBedtime = document.getElementById("plannedBedtime")?.value;
    const plannedWakeTime = document.getElementById("plannedWakeTime")?.value;
    const bedtime = document.getElementById("bedtime")?.value;
    const wakeTime = document.getElementById("wakeTime")?.value;

    const plannedTimeElement = document.getElementById("plannedTimeInBed");
    const actualTimeElement = document.getElementById("timeInBed");
    const efficiencyElement = document.getElementById("sleepEfficiency");
    const timeGapElement = document.getElementById("timeInBedGap");
    const bedtimeGapElement = document.getElementById("bedtimeGap");
    const wakeTimeGapElement = document.getElementById("wakeTimeGap");

    const plannedTimeInBedHours = calculateTimeInBedHours(plannedBedtime, plannedWakeTime);
    const actualTimeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
    const efficiency = calculateSleepEfficiency();

    const bedtimeGap = calculateClockGapMinutes(plannedBedtime, bedtime);
    const wakeTimeGap = calculateClockGapMinutes(plannedWakeTime, wakeTime);

    let timeInBedGapMinutes = null;

    if (plannedTimeInBedHours !== null && actualTimeInBedHours !== null) {
        timeInBedGapMinutes = Math.round((actualTimeInBedHours - plannedTimeInBedHours) * 60);
    }

    if (plannedTimeElement) {
        plannedTimeElement.textContent =
            plannedTimeInBedHours === null ? "未計算" : `${plannedTimeInBedHours.toFixed(1)}時間`;
    }

    if (actualTimeElement) {
        actualTimeElement.textContent =
            actualTimeInBedHours === null ? "未計算" : `${actualTimeInBedHours.toFixed(1)}時間`;
    }

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

    if (timeGapElement) {
        timeGapElement.textContent = formatGapMinutes(timeInBedGapMinutes);
        setSummaryClass(timeGapElement, timeInBedGapMinutes, "gap");
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

// ==============================
// 入力チェック
// ==============================

function checkRange(valueText, label, min, max) {
    const warnings = [];

    if (valueText === "") {
        return warnings;
    }

    const value = Number(valueText);

    if (Number.isNaN(value)) {
        warnings.push(`${label}は数値で入力してください`);
        return warnings;
    }

    if (value < min || value > max) {
        warnings.push(`${label}は${min}〜${max}で入力してください`);
    }

    return warnings;
}

function validateCurrentRecord() {
    const warnings = [];

    const plannedBedtime = document.getElementById("plannedBedtime")?.value;
    const plannedWakeTime = document.getElementById("plannedWakeTime")?.value;
    const bedtime = document.getElementById("bedtime")?.value;
    const wakeTime = document.getElementById("wakeTime")?.value;
    const sleepHoursText = document.getElementById("sleepHours")?.value;
    const awakeCountText = document.getElementById("awakeCount")?.value;
    const moodText = document.getElementById("mood")?.value;
    const sleepinessText = document.getElementById("sleepiness")?.value;
    const fatigueText = document.getElementById("fatigue")?.value;
    const focusText = document.getElementById("focus")?.value;
    const studyTotalText = document.getElementById("studyTotal")?.value;

    const actualTimeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
    const plannedTimeInBedHours = calculateTimeInBedHours(plannedBedtime, plannedWakeTime);
    const sleepHours = Number(sleepHoursText);
    const awakeCount = Number(awakeCountText);
    const studyTotal = Number(studyTotalText);

    if (plannedTimeInBedHours !== null && plannedTimeInBedHours > 14) {
        warnings.push("予定在床時間が14時間を超えています。予定時刻を確認してください");
    }

    if (actualTimeInBedHours !== null && actualTimeInBedHours > 16) {
        warnings.push("実際在床時間が16時間を超えています。就寝・起床時刻を確認してください");
    }

    if (sleepHoursText !== "") {
        if (Number.isNaN(sleepHours)) {
            warnings.push("実睡眠時間は数値で入力してください");
        } else {
            if (sleepHours < 0) {
                warnings.push("実睡眠時間は0以上で入力してください");
            }

            if (sleepHours > 16) {
                warnings.push("実睡眠時間が16時間を超えています。入力値を確認してください");
            }

            if (actualTimeInBedHours !== null && sleepHours > actualTimeInBedHours) {
                warnings.push("実睡眠時間が実際在床時間を超えています。入力値を確認してください");
            }
        }
    }

    if (awakeCountText !== "") {
        if (Number.isNaN(awakeCount)) {
            warnings.push("覚醒回数は数値で入力してください");
        } else if (awakeCount < 0) {
            warnings.push("覚醒回数は0以上で入力してください");
        } else if (awakeCount > 20) {
            warnings.push("覚醒回数が20回を超えています。入力値を確認してください");
        }
    }

    warnings.push(...checkRange(moodText, "気分", 1, 10));
    warnings.push(...checkRange(sleepinessText, "眠気", 1, 10));
    warnings.push(...checkRange(fatigueText, "疲労", 1, 10));
    warnings.push(...checkRange(focusText, "集中力", 1, 10));

    if (studyTotalText !== "") {
        if (Number.isNaN(studyTotal)) {
            warnings.push("総勉強時間は数値で入力してください");
        } else {
            if (studyTotal < 0) {
                warnings.push("総勉強時間は0分以上で入力してください");
            }

            if (studyTotal > 960) {
                warnings.push("総勉強時間が16時間を超えています。入力値を確認してください");
            }
        }
    }

    return warnings;
}

function updateWarnings() {
    const warningList = document.getElementById("warningList");
    const warningCard = document.getElementById("warningCard");

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

// ==============================
// 今日のアドバイス
// ==============================

function updateTodayAdvice() {
    const main = document.getElementById("todayAdviceMain");
    const list = document.getElementById("todayAdviceList");

    if (!main || !list) {
        return;
    }

    const record = getFormData();

    const sleepHours = getNumberOrNull(record.sleepHours);
    const mood = getNumberOrNull(record.mood);
    const sleepiness = getNumberOrNull(record.sleepiness);
    const fatigue = getNumberOrNull(record.fatigue);
    const focus = getNumberOrNull(record.focus);
    const studyTotal = getNumberOrNull(record.studyTotal);

    const efficiency = calculateSleepEfficiencyFromRecord(record);
    const achievement = calculateAchievementFromRecord(record);

    const adviceItems = [];
    let mainText = "今日の状態を入力すると、行動の優先順位を表示します。";

    const hasAnyInput =
        record.bedtime ||
        record.wakeTime ||
        record.sleepHours ||
        record.mood ||
        record.sleepiness ||
        record.fatigue ||
        record.focus ||
        record.studyTotal ||
        record.mainSubject ||
        record.workType ||
        record.memo;

    if (!hasAnyInput) {
        main.textContent = "まずは今日の実績を軽く入力してください。";
        list.innerHTML = "";
        addAdviceItem(list, "睡眠実績、体調、勉強時間のうち1つだけでも入力すれば、助言が具体化されます。", "priority-middle");
        return;
    }

    if (sleepHours !== null) {
        if (sleepHours < 5) {
            mainText = "今日は回復優先です。重い勉強や判断量の多い作業は抑えた方が安全です。";
            adviceItems.push({
                text: "実睡眠が5時間未満です。暗記や軽い復習を中心にして、長時間の新規学習は避ける判断が妥当です。",
                className: "priority-high"
            });
        } else if (sleepHours < 6) {
            mainText = "睡眠がやや不足しています。勉強量よりも継続を優先してください。";
            adviceItems.push({
                text: "実睡眠が6時間未満です。最低限の学習、新聞15分、短い復習のような軽いタスクが向いています。",
                className: "priority-middle"
            });
        } else if (sleepHours >= 7) {
            adviceItems.push({
                text: "実睡眠は十分寄りです。集中力が悪くなければ、重めの科目や理解系の学習を入れやすい日です。",
                className: "priority-good"
            });
        }
    } else {
        adviceItems.push({
            text: "実睡眠時間が未入力です。今日の判断精度を上げるには、まず睡眠時間を入れてください。",
            className: "priority-middle"
        });
    }

    if (efficiency !== null) {
        if (efficiency > 100) {
            adviceItems.push({
                text: "睡眠効率が100%を超えています。実睡眠時間か就寝・起床時刻の入力を確認してください。",
                className: "priority-high"
            });
        } else if (efficiency < 70) {
            adviceItems.push({
                text: "睡眠効率が低めです。横になっていた時間のわりに眠れていない可能性があります。今日は負荷を下げる候補です。",
                className: "priority-middle"
            });
        } else if (efficiency >= 85) {
            adviceItems.push({
                text: "睡眠効率は良好です。睡眠の質は比較的保てている可能性があります。",
                className: "priority-good"
            });
        }
    }

    if (achievement && achievement.canJudgeAchievement) {
        if (achievement.achieved) {
            adviceItems.push({
                text: "就寝・起床は予定から30分以内です。生活リズムは予定通りに近いです。",
                className: "priority-good"
            });
        } else {
            if (achievement.bedtimeGap !== null && Math.abs(achievement.bedtimeGap) > 60) {
                adviceItems.push({
                    text: `就寝が予定から大きくズレています（${formatGapMinutes(achievement.bedtimeGap)}）。次回は寝る前の行動を短くする対策が必要です。`,
                    className: "priority-middle"
                });
            }

            if (achievement.wakeTimeGap !== null && Math.abs(achievement.wakeTimeGap) > 60) {
                adviceItems.push({
                    text: `起床が予定から大きくズレています（${formatGapMinutes(achievement.wakeTimeGap)}）。予定の睡眠枠自体が現実的か確認してください。`,
                    className: "priority-middle"
                });
            }
        }
    }

    if (fatigue !== null && fatigue >= 8) {
        mainText = "疲労が強い日です。今日は成果最大化より、崩れない運用を優先してください。";
        adviceItems.push({
            text: "疲労が8以上です。長時間学習より、短時間で終わるタスクを複数に分ける方が現実的です。",
            className: "priority-high"
        });
    }

    if (sleepiness !== null && sleepiness >= 8) {
        adviceItems.push({
            text: "眠気が強いです。机に向かう前に、短い仮眠・食事・入浴・環境調整のいずれかを検討してください。",
            className: "priority-high"
        });
    }

    if (focus !== null) {
        if (focus <= 3) {
            adviceItems.push({
                text: "集中力が低めです。新しい論点より、既習論点の確認・音読・短答肢のチェックが向いています。",
                className: "priority-middle"
            });
        } else if (focus >= 8) {
            adviceItems.push({
                text: "集中力が高めです。企業法・監査論など、後回しにしやすい科目を少し進める好機です。",
                className: "priority-good"
            });
        }
    }

    if (mood !== null && mood <= 3) {
        adviceItems.push({
            text: "気分が低めです。完璧な勉強計画より、15分だけ着手して記録を残す方が効果的です。",
            className: "priority-middle"
        });
    }

    if (studyTotal !== null) {
        if (studyTotal === 0) {
            adviceItems.push({
                text: "勉強時間が0分です。今日は5〜15分だけでも記録を作ると、継続が途切れにくくなります。",
                className: "priority-middle"
            });
        } else if (studyTotal < 30) {
            adviceItems.push({
                text: "勉強は着手済みです。余力があれば、あと15分だけ追加すると記録として残りやすいです。",
                className: "priority-middle"
            });
        } else if (studyTotal >= 180) {
            adviceItems.push({
                text: "勉強時間は十分です。追加で詰め込むより、睡眠予定を崩さないことを優先してください。",
                className: "priority-good"
            });
        }
    }

    if (record.workType) {
        if (record.workType === "21-8" || record.workType === "21-9" || record.workType === "21-6") {
            adviceItems.push({
                text: "夜勤系の勤務です。勤務前後に重い勉強を置きすぎず、睡眠の確保を最優先にしてください。",
                className: "priority-middle"
            });
        } else if (record.workType === "休み") {
            adviceItems.push({
                text: "休みの日です。睡眠が崩れていなければ、まとまった学習か生活整備を入れやすい日です。",
                className: "priority-good"
            });
        } else if (record.workType === "応援勤務") {
            adviceItems.push({
                text: "応援勤務の日です。移動や緊張で消耗しやすいので、勉強目標は控えめに設定する方が安全です。",
                className: "priority-middle"
            });
        }
    }

    if (record.mainSubject) {
        adviceItems.push({
            text: `主科目は「${record.mainSubject}」です。明日以降の分析で、睡眠や集中力との相性を見ていきます。`,
            className: "priority-good"
        });
    }

    if (
        sleepHours !== null &&
        sleepHours >= 6.5 &&
        fatigue !== null &&
        fatigue <= 5 &&
        sleepiness !== null &&
        sleepiness <= 5 &&
        focus !== null &&
        focus >= 6
    ) {
        mainText = "今日は比較的動ける状態です。重めの学習を入れてもよい日です。";
    }

    if (adviceItems.length === 0) {
        adviceItems.push({
            text: "入力はありますが、判断材料がまだ少なめです。睡眠時間・疲労・集中力を入れると助言が具体化します。",
            className: "priority-middle"
        });
    }

    main.textContent = mainText;
    list.innerHTML = "";

    adviceItems.slice(0, 5).forEach(item => {
        addAdviceItem(list, item.text, item.className);
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

// ==============================
// 自動検知アラート v4.5
// ==============================

function makeAlert(level, title, message, action, priority, key) {
    return {
        level,
        title,
        message,
        action,
        priority,
        key
    };
}

function getDatesWithRecords(days) {
    const records = getRecords();
    let dates;

    if (days === "all") {
        dates = Object.keys(records).sort();
    } else {
        dates = getRecentDates(days);
    }

    return dates.filter(date => records[date]).sort();
}

function getRecentRecords(days) {
    const records = getRecords();
    const dates = getDatesWithRecords(days);

    return dates.map(date => ({
        date,
        record: records[date]
    }));
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

function getPreviousDateRecord(date) {
    const records = getRecords();
    const previousDate = addDays(date, -1);

    return {
        date: previousDate,
        record: records[previousDate] || null
    };
}

function wasNightShift(record) {
    return record && isNightShift(record.workType);
}

function removeDuplicateAlerts(alerts) {
    const result = [];
    const seen = new Set();

    alerts.forEach(alert => {
        if (!alert.key || !seen.has(alert.key)) {
            result.push(alert);
        }

        if (alert.key) {
            seen.add(alert.key);
        }
    });

    return result;
}

function detectAutoAlerts() {
    const alerts = [];
    const items7 = getRecentRecords(7);
    const items14 = getRecentRecords(14);

    if (items7.length === 0) {
        return [
            makeAlert(
                "medium",
                "記録がまだありません",
                "自動検知を行うには、睡眠・体調・勉強時間の記録が必要です。",
                "まずは1日1回、睡眠時間と体調だけでも記録してください。",
                50,
                "no-record"
            )
        ];
    }

    const currentItem = items7[items7.length - 1];
    const currentRecord = currentItem.record;
    const previous = getPreviousDateRecord(currentItem.date);

    const currentSleep = getNumberOrNull(currentRecord.sleepHours);
    const currentFatigue = getNumberOrNull(currentRecord.fatigue);
    const currentSleepiness = getNumberOrNull(currentRecord.sleepiness);
    const currentFocus = getNumberOrNull(currentRecord.focus);
    const currentStudy = getNumberOrNull(currentRecord.studyTotal);

    const previousWasNightShift = wasNightShift(previous.record);
    const todayIsNightShift = wasNightShift(currentRecord);

    const sleepValues7 = [];
    const focusValues7 = [];
    const fatigueValues7 = [];
    const sleepinessValues7 = [];
    const studyValues7 = [];
    const bedtimeGaps7 = [];
    const wakeTimeGaps7 = [];

    let validAchievementDays = 0;
    let achievedDays = 0;
    let nightShiftDays = 0;
    let nightShiftRecoveryProblem = 0;

    items7.forEach(item => {
        const record = item.record;
        const sleep = getNumberOrNull(record.sleepHours);
        const focus = getNumberOrNull(record.focus);
        const fatigue = getNumberOrNull(record.fatigue);
        const sleepiness = getNumberOrNull(record.sleepiness);
        const study = getNumberOrNull(record.studyTotal);
        const achievement = calculateAchievementFromRecord(record);

        if (sleep !== null) {
            sleepValues7.push(sleep);
        }

        if (focus !== null) {
            focusValues7.push(focus);
        }

        if (fatigue !== null) {
            fatigueValues7.push(fatigue);
        }

        if (sleepiness !== null) {
            sleepinessValues7.push(sleepiness);
        }

        if (study !== null) {
            studyValues7.push(study);
        }

        if (achievement) {
            if (achievement.bedtimeGap !== null) {
                bedtimeGaps7.push(achievement.bedtimeGap);
            }

            if (achievement.wakeTimeGap !== null) {
                wakeTimeGaps7.push(achievement.wakeTimeGap);
            }

            if (achievement.canJudgeAchievement) {
                validAchievementDays += 1;

                if (achievement.achieved) {
                    achievedDays += 1;
                }
            }
        }

        if (isNightShift(record.workType)) {
            nightShiftDays += 1;

            if (
                (sleep !== null && sleep < 6) ||
                (fatigue !== null && fatigue >= 8) ||
                (sleepiness !== null && sleepiness >= 8)
            ) {
                nightShiftRecoveryProblem += 1;
            }
        }
    });

    const shortSleepStreak = getConsecutiveCountFromEnd(items14, item => {
        const sleep = getNumberOrNull(item.record.sleepHours);
        return sleep !== null && sleep < 6;
    });

    const studyZeroStreak = getConsecutiveCountFromEnd(items14, item => {
        const study = getNumberOrNull(item.record.studyTotal);
        return study !== null && study === 0;
    });

    const fatigueHighStreak = getConsecutiveCountFromEnd(items14, item => {
        const fatigue = getNumberOrNull(item.record.fatigue);
        return fatigue !== null && fatigue >= 7;
    });

    const sleepinessHighStreak = getConsecutiveCountFromEnd(items14, item => {
        const sleepiness = getNumberOrNull(item.record.sleepiness);
        return sleepiness !== null && sleepiness >= 7;
    });

    const avgSleep = averageNumber(sleepValues7);
    const avgFocus = averageNumber(focusValues7);
    const avgFatigue = averageNumber(fatigueValues7);
    const avgSleepiness = averageNumber(sleepinessValues7);
    const avgBedtimeGap = averageNumber(bedtimeGaps7);
    const avgWakeTimeGap = averageNumber(wakeTimeGaps7);

    const studyDays7 = studyValues7.filter(value => value > 0).length;
    const achievementRate = validAchievementDays === 0 ? null : achievedDays / validAchievementDays * 100;

    if (currentSleep !== null && currentSleep < 5) {
        alerts.push(makeAlert(
            "high",
            "今日の実睡眠が5時間未満です",
            `今日の実睡眠は${currentSleep.toFixed(1)}時間です。今日の学習負荷はかなり慎重に扱うべきです。`,
            "新規論点・長時間講義より、短答肢チェック・復習・新聞15分などに寄せてください。",
            100,
            "today-short-sleep"
        ));
    }

    if (shortSleepStreak >= 2) {
        alerts.push(makeAlert(
            "high",
            `実睡眠6時間未満が${shortSleepStreak}日続いています`,
            "睡眠不足が連続しています。集中力低下、眠気、疲労の悪化につながる可能性があります。",
            "今日は勉強量の最大化より、睡眠枠の確保を優先してください。",
            95,
            "sleep-streak"
        ));
    }

    if (currentFatigue !== null && currentFatigue >= 8) {
        alerts.push(makeAlert(
            "high",
            "今日の疲労が強いです",
            `疲労は${currentFatigue}/10です。ここで無理に詰めると翌日以降に崩れる可能性があります。`,
            "最低限の勉強だけ決め、回復行動を先に入れてください。",
            94,
            "today-fatigue"
        ));
    }

    if (currentSleepiness !== null && currentSleepiness >= 8) {
        alerts.push(makeAlert(
            "high",
            "今日の眠気が強いです",
            `眠気は${currentSleepiness}/10です。机に向かっても効率が落ちやすい状態です。`,
            "仮眠・食事・入浴・室温調整のどれかを入れてから勉強してください。",
            93,
            "today-sleepiness"
        ));
    }

    if (previousWasNightShift && currentSleep !== null && currentSleep < 6) {
        alerts.push(makeAlert(
            "high",
            "夜勤翌日の回復不足が見られます",
            "前日が夜勤系勤務で、翌日の睡眠が6時間未満です。夜勤後の回復が足りていない可能性があります。",
            "夜勤翌日は勉強量ではなく、睡眠確保を成功条件にしてください。",
            92,
            "after-night-shift-sleep"
        ));
    }

    if (fatigueHighStreak >= 2) {
        alerts.push(makeAlert(
            "high",
            `疲労7以上が${fatigueHighStreak}日続いています`,
            "疲労が高止まりしています。勉強量を増やすより、崩れを止める段階です。",
            "企業法・監査論は5〜15分だけ触れる運用にしてください。",
            88,
            "fatigue-streak"
        ));
    }

    if (sleepinessHighStreak >= 2) {
        alerts.push(makeAlert(
            "high",
            `眠気7以上が${sleepinessHighStreak}日続いています`,
            "眠気が高止まりしています。睡眠時間・睡眠効率・夜勤後の回復不足を確認すべきです。",
            "勉強前に眠気対策を入れ、重い学習は後回しにしてください。",
            87,
            "sleepiness-streak"
        ));
    }

    if (avgSleep !== null && avgSleep < 6) {
        alerts.push(makeAlert(
            "medium",
            "直近7日の平均実睡眠が6時間未満です",
            `平均実睡眠は${avgSleep.toFixed(1)}時間です。慢性的に回復量が足りない可能性があります。`,
            "睡眠予定そのものを現実的に修正するか、勤務後の行動を短縮してください。",
            82,
            "avg-sleep"
        ));
    }

    if (avgFocus !== null && avgFocus <= 4) {
        alerts.push(makeAlert(
            "medium",
            "直近7日の平均集中力が低めです",
            `平均集中力は${avgFocus.toFixed(1)}です。理解系・新規論点に入りにくい状態かもしれません。`,
            "講義を長く見るより、5〜15分の小さい単位で着手してください。",
            75,
            "avg-focus"
        ));
    }

    if (studyZeroStreak >= 2) {
        alerts.push(makeAlert(
            "medium",
            `勉強0分が${studyZeroStreak}日続いています`,
            "勉強の再開ハードルが上がり始める状態です。",
            "今日は5分だけでも記録を作ってください。量より再開を優先します。",
            72,
            "study-zero-streak"
        ));
    }

    if (studyDays7 <= 2 && items7.length >= 4) {
        alerts.push(makeAlert(
            "medium",
            "直近7日の勉強日数が少なめです",
            `勉強した日は${studyDays7}日です。継続リズムが弱くなっています。`,
            "毎日長時間ではなく、最低5〜15分の固定枠を作る方が現実的です。",
            68,
            "study-days"
        ));
    }

    if (avgBedtimeGap !== null && Math.abs(avgBedtimeGap) > 60) {
        alerts.push(makeAlert(
            "medium",
            "平均就寝ズレが大きいです",
            `直近7日の平均就寝ズレは${formatGapMinutes(avgBedtimeGap)}です。予定より寝る時刻がズレています。`,
            "理想予定ではなく、まず守れる予定に修正してください。",
            64,
            "bedtime-gap"
        ));
    }

    if (avgWakeTimeGap !== null && Math.abs(avgWakeTimeGap) > 60) {
        alerts.push(makeAlert(
            "medium",
            "平均起床ズレが大きいです",
            `直近7日の平均起床ズレは${formatGapMinutes(avgWakeTimeGap)}です。予定通り起きられていません。`,
            "起床時刻だけでなく、就寝時刻と睡眠時間の不足を確認してください。",
            63,
            "wake-gap"
        ));
    }

    if (achievementRate !== null && achievementRate < 40) {
        alerts.push(makeAlert(
            "medium",
            "予定達成率が低めです",
            `直近7日の予定達成率は${achievementRate.toFixed(0)}%です。現在の睡眠予定が生活実態に合っていない可能性があります。`,
            "予定を30〜60分単位で現実側へ寄せてください。",
            62,
            "achievement"
        ));
    }

    if (nightShiftDays > 0 && nightShiftRecoveryProblem > 0) {
        alerts.push(makeAlert(
            "medium",
            "夜勤後の回復不足が見られます",
            `直近7日の夜勤系勤務${nightShiftDays}回のうち、${nightShiftRecoveryProblem}回で睡眠不足・強い疲労・強い眠気が見られます。`,
            "夜勤後は勉強量を先に決めず、睡眠確保を成功条件にしてください。",
            60,
            "night-shift-recovery"
        ));
    }

    if (todayIsNightShift) {
        alerts.push(makeAlert(
            "medium",
            "今日は夜勤系勤務です",
            "夜勤日は、勤務前後に重い勉強を置きすぎると崩れやすくなります。",
            "勤務前は軽い復習、勤務後は睡眠確保を優先してください。",
            58,
            "today-night-shift"
        ));
    }

    if (sleepValues7.some(value => value >= 9)) {
        alerts.push(makeAlert(
            "medium",
            "9時間以上の睡眠があります",
            "寝すぎの日が見られます。疲労蓄積、休日の寝だめ、睡眠リズムのズレが背景にある可能性があります。",
            "睡眠時間だけでなく、疲労・眠気・勤務区分と合わせて確認してください。",
            52,
            "long-sleep"
        ));
    }

    if (currentFocus !== null && currentFocus >= 7 && currentStudy !== null && currentStudy === 0) {
        alerts.push(makeAlert(
            "medium",
            "集中力があるのに勉強0分です",
            "状態は悪くないのに、勉強に着手できていない可能性があります。",
            "今日は5〜15分だけでも、苦手科目に触れると機会損失を減らせます。",
            66,
            "focus-study-miss"
        ));
    }

    if (
        avgSleep !== null &&
        avgSleep >= 6.5 &&
        avgFatigue !== null &&
        avgFatigue <= 6 &&
        avgSleepiness !== null &&
        avgSleepiness <= 6
    ) {
        alerts.push(makeAlert(
            "good",
            "睡眠と体調は比較的安定しています",
            "平均睡眠・疲労・眠気を見る限り、極端な崩れは出ていません。",
            "集中力が高い日に、企業法・監査論など後回しになりやすい科目を小さく進めてください。",
            30,
            "stable-condition"
        ));
    }

    if (achievementRate !== null && achievementRate >= 70) {
        alerts.push(makeAlert(
            "good",
            "睡眠予定を比較的守れています",
            `直近7日の予定達成率は${achievementRate.toFixed(0)}%です。生活リズムの土台は作れています。`,
            "この状態を崩さず、勉強時間を少しずつ増やしてください。",
            28,
            "good-achievement"
        ));
    }

    if (studyDays7 >= 5) {
        alerts.push(makeAlert(
            "good",
            "勉強の継続はできています",
            `直近7日のうち${studyDays7}日で勉強記録があります。継続の土台はあります。`,
            "今後は時間だけでなく、科目配分と苦手科目への着手を見てください。",
            26,
            "good-study"
        ));
    }

    let cleaned = removeDuplicateAlerts(alerts);

    cleaned.sort((a, b) => b.priority - a.priority);

    const highOrMedium = cleaned.filter(alert => alert.level !== "good");
    const good = cleaned.filter(alert => alert.level === "good");

    if (highOrMedium.length === 0 && good.length === 0) {
        return [
            makeAlert(
                "good",
                "大きな警戒サインは見つかっていません",
                "直近の記録では、睡眠・体調・勉強の大きな崩れは検出されていません。",
                "このまま記録を続けると、相関分析の精度も上がります。",
                20,
                "no-problem"
            )
        ];
    }

    return [...highOrMedium.slice(0, 5), ...good.slice(0, 3)].slice(0, 8);
}

function getAutoAlertConclusion(alerts) {
    const highCount = alerts.filter(alert => alert.level === "high").length;
    const mediumCount = alerts.filter(alert => alert.level === "medium").length;
    const goodCount = alerts.filter(alert => alert.level === "good").length;

    if (highCount >= 2) {
        return "今日は回復優先です。勉強量を増やすより、睡眠・疲労・眠気の悪化を止める判断が妥当です。";
    }

    if (highCount === 1) {
        return "今日は慎重運用です。重い勉強は抑え、最低限の継続と回復を優先してください。";
    }

    if (mediumCount >= 3) {
        return "大崩れではありませんが、生活リズムのズレが出ています。今日は予定を詰めすぎない方が安全です。";
    }

    if (mediumCount >= 1) {
        return "軽い注意点があります。勉強は可能ですが、睡眠予定と疲労の管理を優先してください。";
    }

    if (goodCount >= 1) {
        return "大きな警戒サインはありません。状態が良い時間に苦手科目を小さく進める余地があります。";
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
    const list = document.getElementById("autoAlertList");
    const highCount = document.getElementById("alertHighCount");
    const mediumCount = document.getElementById("alertMediumCount");
    const goodCount = document.getElementById("alertGoodCount");
    const conclusion = document.getElementById("autoAlertConclusion");

    if (!list) {
        return;
    }

    const alerts = detectAutoAlerts();

    const high = alerts.filter(alert => alert.level === "high").length;
    const medium = alerts.filter(alert => alert.level === "medium").length;
    const good = alerts.filter(alert => alert.level === "good").length;

    if (highCount) {
        highCount.textContent = `${high}件`;
        highCount.className = high > 0 ? "summary-value danger" : "summary-value";
    }

    if (mediumCount) {
        mediumCount.textContent = `${medium}件`;
        mediumCount.className = medium > 0 ? "summary-value warning" : "summary-value";
    }

    if (goodCount) {
        goodCount.textContent = `${good}件`;
        goodCount.className = good > 0 ? "summary-value good" : "summary-value";
    }

    if (conclusion) {
        conclusion.textContent = getAutoAlertConclusion(alerts);
    }

    list.innerHTML = "";

    alerts.forEach(alert => {
        list.appendChild(renderAlertItem(alert));
    });
}

// ==============================
// 相関分析 v4.5
// ==============================

function getCorrelationRangeValue() {
    const select = document.getElementById("correlationRange");
    return select ? select.value : "30";
}

function getCorrelationDates() {
    const range = getCorrelationRangeValue();

    if (range === "all") {
        return Object.keys(getRecords()).sort();
    }

    return getRecentDates(Number(range));
}

function getMetricValue(record, metricKey) {
    if (!record) {
        return null;
    }

    if (metricKey === "sleepHours") {
        return getNumberOrNull(record.sleepHours);
    }

    if (metricKey === "sleepEfficiency") {
        const value = calculateSleepEfficiencyFromRecord(record);
        return value !== null && value <= 100 ? value : null;
    }

    if (metricKey === "mood") {
        return getNumberOrNull(record.mood);
    }

    if (metricKey === "sleepiness") {
        return getNumberOrNull(record.sleepiness);
    }

    if (metricKey === "fatigue") {
        return getNumberOrNull(record.fatigue);
    }

    if (metricKey === "focus") {
        return getNumberOrNull(record.focus);
    }

    if (metricKey === "studyTotal") {
        return getNumberOrNull(record.studyTotal);
    }

    if (metricKey === "bedtimeGap") {
        const achievement = calculateAchievementFromRecord(record);
        return achievement ? achievement.bedtimeGap : null;
    }

    if (metricKey === "wakeTimeGap") {
        const achievement = calculateAchievementFromRecord(record);
        return achievement ? achievement.wakeTimeGap : null;
    }

    if (metricKey === "nightShift") {
        return isNightShift(record.workType) ? 1 : 0;
    }

    return null;
}

function buildCorrelationPairs(records, dates, xKey, yKey, lagDays) {
    const pairs = [];

    dates.forEach(date => {
        const xDate = lagDays ? addDays(date, -lagDays) : date;
        const yDate = date;

        const xRecord = records[xDate];
        const yRecord = records[yDate];

        const x = getMetricValue(xRecord, xKey);
        const y = getMetricValue(yRecord, yKey);

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
    if (sampleSize < 7 || r === null) {
        return "insufficient";
    }

    const abs = Math.abs(r);

    if (abs >= 0.7) {
        return "strong";
    }

    if (abs >= 0.5) {
        return "middle";
    }

    if (abs >= 0.3) {
        return "weak";
    }

    return "none";
}

function getCorrelationLevelLabel(level) {
    if (level === "strong") {
        return "強い相関";
    }

    if (level === "middle") {
        return "中程度";
    }

    if (level === "weak") {
        return "弱い相関";
    }

    if (level === "insufficient") {
        return "データ不足";
    }

    return "目立つ相関なし";
}

function getCorrelationClass(level) {
    if (level === "strong") {
        return "strong";
    }

    if (level === "middle") {
        return "middle";
    }

    if (level === "weak") {
        return "weak";
    }

    if (level === "insufficient") {
        return "insufficient";
    }

    return "weak";
}

function reliabilityText(sampleSize) {
    if (sampleSize < 7) {
        return "有効データが7件未満のため、判定しません。";
    }

    if (sampleSize < 14) {
        return "有効データが少ないため、参考値です。";
    }

    if (sampleSize < 30) {
        return "ある程度の傾向として確認できます。";
    }

    return "比較的安定した傾向として確認できます。";
}

function interpretCorrelation(config, r) {
    if (r === null) {
        return "片方または両方の値が一定で、相関を計算できません。";
    }

    const direction = r >= 0 ? "正" : "負";

    if (config.customMessage) {
        return config.customMessage(direction, r);
    }

    if (r >= 0) {
        return `${config.xLabel}が高い日は、${config.yLabel}も高くなる傾向があります。`;
    }

    return `${config.xLabel}が高い日は、${config.yLabel}が低くなる傾向があります。`;
}

function getCorrelationConfigs() {
    return [
        {
            xKey: "sleepHours",
            yKey: "focus",
            xLabel: "睡眠時間",
            yLabel: "集中力",
            title: "睡眠時間 × 集中力",
            lagDays: 0,
            rankingGroup: "focus",
            factorLabel: "睡眠時間"
        },
        {
            xKey: "sleepEfficiency",
            yKey: "focus",
            xLabel: "睡眠効率",
            yLabel: "集中力",
            title: "睡眠効率 × 集中力",
            lagDays: 0,
            rankingGroup: "focus",
            factorLabel: "睡眠効率"
        },
        {
            xKey: "sleepHours",
            yKey: "sleepiness",
            xLabel: "睡眠時間",
            yLabel: "眠気",
            title: "睡眠時間 × 眠気",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "睡眠不足と眠気"
        },
        {
            xKey: "sleepHours",
            yKey: "fatigue",
            xLabel: "睡眠時間",
            yLabel: "疲労",
            title: "睡眠時間 × 疲労",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "睡眠不足と疲労"
        },
        {
            xKey: "focus",
            yKey: "studyTotal",
            xLabel: "集中力",
            yLabel: "勉強時間",
            title: "集中力 × 勉強時間",
            lagDays: 0,
            rankingGroup: "study",
            factorLabel: "集中力"
        },
        {
            xKey: "fatigue",
            yKey: "studyTotal",
            xLabel: "疲労",
            yLabel: "勉強時間",
            title: "疲労 × 勉強時間",
            lagDays: 0,
            rankingGroup: "study",
            factorLabel: "疲労"
        },
        {
            xKey: "sleepiness",
            yKey: "studyTotal",
            xLabel: "眠気",
            yLabel: "勉強時間",
            title: "眠気 × 勉強時間",
            lagDays: 0,
            rankingGroup: "study",
            factorLabel: "眠気"
        },
        {
            xKey: "bedtimeGap",
            yKey: "studyTotal",
            xLabel: "就寝ズレ",
            yLabel: "勉強時間",
            title: "就寝ズレ × 勉強時間",
            lagDays: 0,
            rankingGroup: "study",
            factorLabel: "就寝ズレ"
        },
        {
            xKey: "wakeTimeGap",
            yKey: "studyTotal",
            xLabel: "起床ズレ",
            yLabel: "勉強時間",
            title: "起床ズレ × 勉強時間",
            lagDays: 0,
            rankingGroup: "study",
            factorLabel: "起床ズレ"
        },
        {
            xKey: "sleepHours",
            yKey: "focus",
            xLabel: "前日の睡眠時間",
            yLabel: "翌日の集中力",
            title: "前日睡眠 × 翌日集中力",
            lagDays: 1,
            rankingGroup: "focus",
            factorLabel: "前日の睡眠",
            customMessage: function (direction) {
                if (direction === "正") {
                    return "前日の睡眠時間が長いほど、翌日の集中力が高くなる傾向があります。";
                }

                return "前日の睡眠時間が長いほど、翌日の集中力が低い傾向があります。ただし疲労による寝すぎの影響も疑うべきです。";
            }
        },
        {
            xKey: "fatigue",
            yKey: "studyTotal",
            xLabel: "前日の疲労",
            yLabel: "翌日の勉強時間",
            title: "前日疲労 × 翌日勉強時間",
            lagDays: 1,
            rankingGroup: "study",
            factorLabel: "前日の疲労",
            customMessage: function (direction) {
                if (direction === "正") {
                    return "前日の疲労が高いほど、翌日の勉強時間も長い傾向があります。無理をしている可能性も確認してください。";
                }

                return "前日の疲労が高いほど、翌日の勉強時間が短くなる傾向があります。回復不足が勉強量に影響している可能性があります。";
            }
        },
        {
            xKey: "nightShift",
            yKey: "sleepHours",
            xLabel: "夜勤",
            yLabel: "睡眠時間",
            title: "夜勤 × 睡眠時間",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "夜勤と睡眠",
            customMessage: function (direction) {
                if (direction === "正") {
                    return "夜勤の日ほど睡眠時間が長い傾向があります。夜勤後に睡眠を確保できている可能性があります。";
                }

                return "夜勤の日ほど睡眠時間が短い傾向があります。夜勤後の回復不足を確認してください。";
            }
        },
        {
            xKey: "nightShift",
            yKey: "fatigue",
            xLabel: "夜勤",
            yLabel: "疲労",
            title: "夜勤 × 疲労",
            lagDays: 0,
            rankingGroup: "risk",
            factorLabel: "夜勤と疲労",
            customMessage: function (direction) {
                if (direction === "正") {
                    return "夜勤の日ほど疲労が高い傾向があります。夜勤後の回復計画を重視してください。";
                }

                return "夜勤の日ほど疲労が低い傾向があります。現状では夜勤適応が比較的できている可能性があります。";
            }
        }
    ];
}

function calculateCorrelationResults() {
    const records = getRecords();
    const dates = getCorrelationDates();
    const configs = getCorrelationConfigs();

    return configs.map(config => {
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
        return "まだ判断できる相関はありません。睡眠・体調・勉強時間を同じ日に入力すると、分析できます。";
    }

    const top = validResults[0];
    const sign = top.r >= 0 ? "正" : "負";
    const strength = getCorrelationLevelLabel(top.level);

    return `最も目立つのは「${top.title}」です。${strength}の${sign}の関係があり、${interpretCorrelation(top, top.r)}`;
}

function renderCorrelationItem(result) {
    const item = document.createElement("div");
    const itemClass = getCorrelationClass(result.level);
    item.className = `correlation-item ${itemClass}`;

    const levelLabel = getCorrelationLevelLabel(result.level);
    const rText = result.r === null ? "r = 未計算" : `r = ${result.r >= 0 ? "+" : ""}${result.r.toFixed(2)}`;
    const message = result.level === "insufficient"
        ? "有効データが不足しています。両方の項目が入力されている日を増やしてください。"
        : interpretCorrelation(result, result.r);

    const lagText = result.lagDays === 1 ? "前日→翌日" : "当日同士";

    item.innerHTML = `
        <span class="correlation-level ${itemClass}">${levelLabel}</span>
        <span class="correlation-r">${rText}</span>
        <p class="correlation-title">${result.title}</p>
        <p class="correlation-message">${message}</p>
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
    const container = document.getElementById(containerId);

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
            if (result.title.includes("疲労") && result.r > 0) {
                return true;
            }

            if (result.title.includes("眠気") && result.r > 0) {
                return true;
            }

            if (result.title.includes("勉強時間") && result.r < 0) {
                return true;
            }

            if (result.title.includes("集中力") && result.r < 0) {
                return true;
            }

            if (result.title.includes("夜勤") && result.r > 0) {
                return true;
            }

            return false;
        })
        .sort((a, b) => b.absR - a.absR)
        .slice(0, 3);
}

function updateCorrelationRankings(results) {
    renderFactorRanking(
        "studyFactorRanking",
        buildRankingItems(results, "study"),
        "勉強時間と関係が見える項目はまだありません。"
    );

    renderFactorRanking(
        "focusFactorRanking",
        buildRankingItems(results, "focus"),
        "集中力と関係が見える項目はまだありません。"
    );

    renderFactorRanking(
        "riskFactorRanking",
        buildRiskRankingItems(results),
        "悪化要因候補はまだ見つかっていません。"
    );
}

function updateCorrelationAnalysis() {
    const list = document.getElementById("correlationList");
    const validCountElement = document.getElementById("correlationValidCount");
    const topStrengthElement = document.getElementById("correlationTopStrength");
    const insightElement = document.getElementById("correlationInsight");

    if (!list) {
        return;
    }

    const results = calculateCorrelationResults();

    const displayResults = results
        .filter(result => result.level !== "none")
        .sort((a, b) => {
            if (a.level === "insufficient" && b.level !== "insufficient") {
                return 1;
            }

            if (a.level !== "insufficient" && b.level === "insufficient") {
                return -1;
            }

            return b.absR - a.absR;
        })
        .slice(0, 8);

    const validResults = results.filter(result => result.level !== "none" && result.level !== "insufficient");
    const top = validResults.slice().sort((a, b) => b.absR - a.absR)[0];

    if (validCountElement) {
        validCountElement.textContent = `${validResults.length}件`;
    }

    if (topStrengthElement) {
        if (top) {
            topStrengthElement.textContent = `${top.r >= 0 ? "+" : ""}${top.r.toFixed(2)}`;
            topStrengthElement.className = top.absR >= 0.7
                ? "summary-value good"
                : top.absR >= 0.5
                    ? "summary-value warning"
                    : "summary-value";
        } else {
            topStrengthElement.textContent = "未計算";
            topStrengthElement.className = "summary-value";
        }
    }

    if (insightElement) {
        insightElement.textContent = getCorrelationInsight(results);
    }

    updateCorrelationRankings(results);

    list.innerHTML = "";

    if (displayResults.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "目立つ相関はまだ見つかっていません。記録が増えると分析精度が上がります。";
        list.appendChild(empty);
        return;
    }

    displayResults.forEach(result => {
        list.appendChild(renderCorrelationItem(result));
    });
}

function setupCorrelationEvents() {
    const select = document.getElementById("correlationRange");

    if (select) {
        select.addEventListener("change", updateCorrelationAnalysis);
    }
}

// ==============================
// AI相談用テキスト
// ==============================

function valueOrDash(value) {
    return value === undefined || value === null || value === "" ? "未入力" : value;
}

function isNightShift(workType) {
    return workType === "21-6" || workType === "21-8" || workType === "21-9";
}

function getSelectedConsultType() {
    const selected = document.querySelector('input[name="consultType"]:checked');
    return selected ? selected.value : "today";
}

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

        const sleepHours = getNumberOrNull(record.sleepHours);
        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const focus = getNumberOrNull(record.focus);
        const fatigue = getNumberOrNull(record.fatigue);
        const sleepiness = getNumberOrNull(record.sleepiness);
        const study = getNumberOrNull(record.studyTotal);
        const achievement = calculateAchievementFromRecord(record);

        if (sleepHours !== null) {
            sleepValues.push(sleepHours);

            if (sleepHours < 6) {
                sleepShortDays += 1;
            }

            if (sleepHours >= 9) {
                sleepLongDays += 1;
            }
        }

        if (efficiency !== null && efficiency <= 100) {
            efficiencyValues.push(efficiency);
        }

        if (focus !== null) {
            focusValues.push(focus);
        }

        if (fatigue !== null) {
            fatigueValues.push(fatigue);
        }

        if (sleepiness !== null) {
            sleepinessValues.push(sleepiness);
        }

        if (study !== null) {
            studyTotal += study;

            if (study > 0) {
                studyDays += 1;
            }

            const subject = record.mainSubject || "未選択";
            subjectStudyTotals[subject] = (subjectStudyTotals[subject] || 0) + study;
        }

        if (isNightShift(record.workType)) {
            nightShiftDays += 1;
        }

        if (achievement) {
            if (achievement.bedtimeGap !== null) {
                bedtimeGaps.push(achievement.bedtimeGap);
            }

            if (achievement.wakeTimeGap !== null) {
                wakeTimeGaps.push(achievement.wakeTimeGap);
            }

            if (achievement.canJudgeAchievement) {
                achievementTargetCount += 1;

                if (achievement.achieved) {
                    achievedCount += 1;
                }
            }
        }
    });

    const achievementRate =
        achievementTargetCount === 0
            ? null
            : achievedCount / achievementTargetCount * 100;

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
        achievementRate,
        subjectStudyTotals
    };
}

function buildPeriodSummaryText(title, dates, stats) {
    const firstDate = dates[0] || "不明";
    const lastDate = dates[dates.length - 1] || "不明";

    const achievementText =
        stats.achievementTargetCount === 0
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
        `合計勉強時間：${stats.studyTotal}分（${(stats.studyTotal / 60).toFixed(1)}時間）`,
        `勉強した日数：${stats.studyDays}日`,
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
        return [
            "【月別要約】",
            "保存されている記録がありません。"
        ].join("\n");
    }

    const recentMonthKeys = monthKeys.slice(-12);
    const lines = ["【月別要約】", "※ 最大で直近12か月分を表示します。"];

    recentMonthKeys.forEach(monthKey => {
        const dates = monthMap[monthKey];
        const stats = buildPeriodStats(records, dates);

        const achievementText =
            stats.achievementTargetCount === 0
                ? "未計算"
                : `${Math.round(stats.achievementRate)}%`;

        const studyHoursText = `${(stats.studyTotal / 60).toFixed(1)}時間`;

        lines.push(
            `${monthKey}：記録${stats.recordDays}日、平均睡眠${averageText(stats.sleepValues, "時間")}、勉強${studyHoursText}、勉強日${stats.studyDays}日、夜勤${stats.nightShiftDays}回、平均集中${averageText(stats.focusValues, "")}、予定達成率${achievementText}`
        );
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
        return [
            `【直近${days}日の科目別勉強時間】`,
            "勉強時間の記録がありません。"
        ].join("\n");
    }

    const lines = [`【直近${days}日の科目別勉強時間】`];

    entries.forEach(([subject, minutes]) => {
        lines.push(`${subject}：${minutes}分（${(minutes / 60).toFixed(1)}時間）`);
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

        const efficiencyText =
            efficiency === null
                ? "未計算"
                : efficiency > 100
                    ? `${efficiency.toFixed(1)}%（要確認）`
                    : `${efficiency.toFixed(1)}%`;

        const achievementText =
            achievement && achievement.canJudgeAchievement
                ? achievement.achieved
                    ? "予定達成"
                    : "予定未達"
                : "予定判定なし";

        lines.push(
            `${date}：睡眠${valueOrDash(record.sleepHours)}h、効率${efficiencyText}、気分${valueOrDash(record.mood)}、眠気${valueOrDash(record.sleepiness)}、疲労${valueOrDash(record.fatigue)}、集中${valueOrDash(record.focus)}、勉強${valueOrDash(record.studyTotal)}分、勤務${valueOrDash(record.workType)}、${achievementText}`
        );
    });

    return [
        "【直近7日の各日データ】",
        ...lines
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

function buildCorrelationSummaryText() {
    const results = calculateCorrelationResults();
    const validResults = results
        .filter(result => result.level !== "none" && result.level !== "insufficient")
        .sort((a, b) => b.absR - a.absR)
        .slice(0, 5);

    if (validResults.length === 0) {
        return [
            "【相関分析】",
            "有効な相関はまだ見つかっていません。記録が増えると分析精度が上がります。"
        ].join("\n");
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

    const plannedWakeText = formatTimeWithNextDay(record.plannedBedtime, record.plannedWakeTime);
    const actualWakeText = formatTimeWithNextDay(record.bedtime, record.wakeTime);

    const efficiencyText =
        efficiency === null
            ? "未計算"
            : efficiency > 100
                ? `${efficiency.toFixed(1)}%（要確認）`
                : `${efficiency.toFixed(1)}%`;

    const plannedTimeText =
        plannedTimeInBed === null ? "未計算" : `${plannedTimeInBed.toFixed(1)}時間`;

    const actualTimeText =
        actualTimeInBed === null ? "未計算" : `${actualTimeInBed.toFixed(1)}時間`;

    const bedtimeGapText =
        achievement && achievement.bedtimeGap !== null
            ? formatGapMinutes(achievement.bedtimeGap)
            : "未計算";

    const wakeGapText =
        achievement && achievement.wakeTimeGap !== null
            ? formatGapMinutes(achievement.wakeTimeGap)
            : "未計算";

    const timeInBedGapText =
        achievement && achievement.timeInBedGap !== null
            ? formatGapMinutes(achievement.timeInBedGap)
            : "未計算";

    const achievementText =
        achievement && achievement.canJudgeAchievement
            ? achievement.achieved
                ? "予定達成"
                : "予定未達"
            : "未計算";

    return [
        "【現在選択中の日付】",
        `日付：${date}`,
        "",
        "【睡眠】",
        `予定就寝：${valueOrDash(record.plannedBedtime)}`,
        `予定起床：${plannedWakeText}`,
        `実際就寝：${valueOrDash(record.bedtime)}`,
        `実際起床：${actualWakeText}`,
        `予定在床時間：${plannedTimeText}`,
        `実際在床時間：${actualTimeText}`,
        `実睡眠時間：${valueOrDash(record.sleepHours)}時間`,
        `覚醒回数：${valueOrDash(record.awakeCount)}`,
        `睡眠効率：${efficiencyText}`,
        `就寝ズレ：${bedtimeGapText}`,
        `起床ズレ：${wakeGapText}`,
        `在床差：${timeInBedGapText}`,
        `予定達成判定：${achievementText}`,
        "",
        "【体調】",
        `気分：${valueOrDash(record.mood)} / 10`,
        `眠気：${valueOrDash(record.sleepiness)} / 10`,
        `疲労：${valueOrDash(record.fatigue)} / 10`,
        `集中力：${valueOrDash(record.focus)} / 10`,
        "",
        "【勉強・勤務】",
        `総勉強時間：${valueOrDash(record.studyTotal)}分`,
        `主に勉強した科目：${valueOrDash(record.mainSubject)}`,
        `勤務区分：${valueOrDash(record.workType)}`,
        "",
        "【メモ】",
        valueOrDash(record.memo)
    ].join("\n");
}

function buildCommonOpening() {
    return [
        "以下は、私の生活記録アプリから出力したデータです。",
        "公認会計士試験の勉強、夜勤を含む勤務、睡眠リズムの安定を両立したいです。",
        "極端な根性論ではなく、現実的に継続できる提案をしてください。"
    ].join("\n");
}

function buildTodayConsultText(date, record, records) {
    return [
        buildCommonOpening(),
        "このデータをもとに、今日の過ごし方、勉強負荷、勤務前後の動き方、翌日の注意点を具体的に助言してください。",
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildWeeklySummaryText(records),
        "",
        buildRecentDailyLines(records),
        "",
        "【相談したいこと】",
        "1. 今日の勉強量は増やすべきか、抑えるべきか。",
        "2. 勤務前後に何を優先すべきか。",
        "3. 疲労・眠気・集中力から見て、今日の最適行動は何か。",
        "4. 明日以降に崩れないための注意点は何か。"
    ].join("\n");
}

function buildThirtyDayConsultText(date, record, records) {
    return [
        buildCommonOpening(),
        "直近30日の傾向をもとに、睡眠・疲労・勉強継続・夜勤適応の改善点を分析してください。",
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildWeeklySummaryText(records),
        "",
        buildThirtyDaySummaryText(records),
        "",
        buildCorrelationSummaryText(),
        "",
        buildRecentDailyLines(records),
        "",
        "【相談したいこと】",
        "1. 直近30日の生活リズムの問題点は何か。",
        "2. 睡眠不足・寝すぎ・予定未達のどれを優先的に直すべきか。",
        "3. 勉強時間を増やすには、どの時間帯に固定すべきか。",
        "4. 夜勤がある中で、現実的な改善策は何か。"
    ].join("\n");
}

function buildLongConsultText(date, record, records) {
    return [
        buildCommonOpening(),
        "月別要約から、半年〜1年単位で見た長期傾向と改善方針を分析してください。",
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildThirtyDaySummaryText(records),
        "",
        buildMonthlySummaryText(records),
        "",
        buildCorrelationSummaryText(),
        "",
        "【相談したいこと】",
        "1. 月別に見て、睡眠・勉強・夜勤適応は改善しているか、悪化しているか。",
        "2. 長期的に最も足を引っ張っている要因は何か。",
        "3. 今後1か月で最優先に改善すべき行動は何か。",
        "4. 無理なく継続するための月間目標をどう設定すべきか。"
    ].join("\n");
}

function buildExamConsultText(date, record, records) {
    return [
        buildCommonOpening(),
        "公認会計士試験の短答・論文を見据えて、生活データから現実的な勉強計画を立ててください。",
        "特に、企業法・監査論への苦手意識、夜勤、睡眠リズムを考慮してください。",
        "",
        buildCurrentDayText(date, record),
        "",
        buildAutoAlertsText(),
        "",
        buildWeeklySummaryText(records),
        "",
        buildThirtyDaySummaryText(records),
        "",
        buildSubjectSummaryText(records, 30),
        "",
        buildCorrelationSummaryText(),
        "",
        buildMonthlySummaryText(records),
        "",
        "【相談したいこと】",
        "1. 現在の生活リズムで、1日の現実的な勉強時間はどれくらいか。",
        "2. 企業法・監査論を避けずに進めるには、どのように小さく始めるべきか。",
        "3. 睡眠と夜勤を崩さずに勉強時間を増やす方法は何か。",
        "4. 直近1か月の勉強計画を、現実的な最低ラインと標準ラインで提案してほしい。"
    ].join("\n");
}

function buildAiConsultTextByType(type, date, record, records) {
    if (type === "thirty") {
        return buildThirtyDayConsultText(date, record, records);
    }

    if (type === "long") {
        return buildLongConsultText(date, record, records);
    }

    if (type === "exam") {
        return buildExamConsultText(date, record, records);
    }

    return buildTodayConsultText(date, record, records);
}

function getConsultTypeLabel(type) {
    if (type === "thirty") {
        return "直近30日の生活改善相談";
    }

    if (type === "long") {
        return "長期傾向分析";
    }

    if (type === "exam") {
        return "試験勉強計画相談";
    }

    return "今日の行動相談";
}

function generateAiConsultText() {
    saveCurrentRecord();

    const records = getRecords();
    const dateElement = document.getElementById("recordDate");
    const textarea = document.getElementById("aiConsultText");
    const copyStatus = document.getElementById("copyStatus");

    if (!dateElement || !textarea) {
        return;
    }

    const date = dateElement.value || getTodayString();
    const record = records[date] || getFormData();
    const consultType = getSelectedConsultType();

    textarea.value = buildAiConsultTextByType(consultType, date, record, records);

    if (copyStatus) {
        copyStatus.textContent = `作成しました：${getConsultTypeLabel(consultType)}`;
    }
}

function copyAiConsultText() {
    const textarea = document.getElementById("aiConsultText");
    const copyStatus = document.getElementById("copyStatus");

    if (!textarea || !textarea.value) {
        if (copyStatus) {
            copyStatus.textContent = "コピーするテキストがありません。先に作成してください。";
        }
        return;
    }

    textarea.focus();
    textarea.select();

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                if (copyStatus) {
                    copyStatus.textContent = "コピーしました。ChatGPTに貼り付けて相談できます。";
                }
            })
            .catch(() => {
                fallbackCopyText(textarea, copyStatus);
            });
    } else {
        fallbackCopyText(textarea, copyStatus);
    }
}

function fallbackCopyText(textarea, copyStatus) {
    try {
        document.execCommand("copy");

        if (copyStatus) {
            copyStatus.textContent = "コピーしました。";
        }
    } catch (error) {
        console.error(error);

        if (copyStatus) {
            copyStatus.textContent = "自動コピーに失敗しました。テキストを手動で選択してコピーしてください。";
        }
    }
}

function setupAiTextEvents() {
    const generateButton = document.getElementById("generateAiTextButton");
    const copyButton = document.getElementById("copyAiTextButton");
    const consultTypeInputs = document.querySelectorAll('input[name="consultType"]');
    const textarea = document.getElementById("aiConsultText");
    const copyStatus = document.getElementById("copyStatus");

    if (generateButton) {
        generateButton.addEventListener("click", generateAiConsultText);
    }

    if (copyButton) {
        copyButton.addEventListener("click", copyAiConsultText);
    }

    consultTypeInputs.forEach(input => {
        input.addEventListener("change", () => {
            if (textarea) {
                textarea.value = "";
            }

            if (copyStatus) {
                copyStatus.textContent = `相談タイプを変更しました：${getConsultTypeLabel(getSelectedConsultType())}`;
            }
        });
    });
}

// ==============================
// グラフ
// ==============================

function getChartRangeValue() {
    const select = document.getElementById("chartRange");
    return select ? select.value : "30";
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
    return dates.map(date => {
        if (dates.length > 40) {
            return date.slice(5);
        }

        return formatShortDate(date);
    });
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

        if (gapType === "bedtime") {
            return achievement.bedtimeGap;
        }

        if (gapType === "wake") {
            return achievement.wakeTimeGap;
        }

        return null;
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
    const canvas = document.getElementById(canvasId);

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
    const canvas = document.getElementById(config.canvasId);

    if (!canvas) {
        return;
    }

    resizeCanvasForDisplay(canvas);

    const ctx = canvas.getContext("2d");
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    const padding = {
        top: 24,
        right: 16,
        bottom: 42,
        left: 44
    };

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
    ctx.globalAlpha = 1;
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

        const x = xForIndex(index);
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, x, padding.top + chartHeight + 18);
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

            const x = xForIndex(index);
            const y = yForValue(value);
            const radius = isActive ? 5 : isInactive ? 2 : 3;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    });

    if (datasets.length > 1 && config.showLegend !== false) {
        let legendX = padding.left;
        const legendY = 14;

        datasets.forEach(dataset => {
            const isActive = config.activeKey && dataset.key === config.activeKey;
            const isInactive = config.activeKey && dataset.key !== config.activeKey;

            ctx.globalAlpha = isInactive ? 0.35 : 1;
            ctx.fillStyle = dataset.color;
            ctx.fillRect(legendX, legendY - 8, 10, 10);

            ctx.fillStyle = isActive ? "#111827" : "#334155";
            ctx.font = isActive ? "bold 12px sans-serif" : "12px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(dataset.label, legendX + 14, legendY);

            ctx.globalAlpha = 1;
            legendX += dataset.label.length * 12 + 42;
        });
    }
}

function getConditionDatasetLabel(key) {
    if (key === "mood") {
        return "気分";
    }

    if (key === "sleepiness") {
        return "眠気";
    }

    if (key === "fatigue") {
        return "疲労";
    }

    if (key === "focus") {
        return "集中力";
    }

    return "なし";
}

function updateConditionChartButtons() {
    const buttons = document.querySelectorAll(".condition-chart-button");
    const status = document.getElementById("conditionChartFocusStatus");

    buttons.forEach(button => {
        if (button.dataset.conditionKey === activeConditionChartKey) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    if (status) {
        if (activeConditionChartKey) {
            status.textContent = `現在の強調：${getConditionDatasetLabel(activeConditionChartKey)}`;
        } else {
            status.textContent = "現在の強調：なし（全項目表示）";
        }
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
                label: "勉強時間",
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
            {
                key: "mood",
                label: "気分",
                color: "#db2777",
                values: buildSeriesFromRecords(dates, "mood")
            },
            {
                key: "sleepiness",
                label: "眠気",
                color: "#f59e0b",
                values: buildSeriesFromRecords(dates, "sleepiness")
            },
            {
                key: "fatigue",
                label: "疲労",
                color: "#dc2626",
                values: buildSeriesFromRecords(dates, "fatigue")
            },
            {
                key: "focus",
                label: "集中力",
                color: "#7c3aed",
                values: buildSeriesFromRecords(dates, "focus")
            }
        ]
    });

    drawLineChart({
        canvasId: "gapChart",
        labels,
        valueDecimals: 0,
        includeZero: true,
        datasets: [
            {
                key: "bedtimeGap",
                label: "就寝ズレ",
                color: "#0f766e",
                values: buildGapSeries(dates, "bedtime")
            },
            {
                key: "wakeTimeGap",
                label: "起床ズレ",
                color: "#ea580c",
                values: buildGapSeries(dates, "wake")
            }
        ]
    });

    updateConditionChartButtons();
}

function setupChartEvents() {
    const chartRange = document.getElementById("chartRange");
    const conditionButtons = document.querySelectorAll(".condition-chart-button");

    if (chartRange) {
        chartRange.addEventListener("change", updateCharts);
    }

    conditionButtons.forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.conditionKey;

            if (activeConditionChartKey === key) {
                activeConditionChartKey = "";
            } else {
                activeConditionChartKey = key;
            }

            updateCharts();
        });
    });

    window.addEventListener("resize", () => {
        updateCharts();
    });
}

// ==============================
// サマリー
// ==============================

function updateAllCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
    updateTodayAdvice();
}

function updateWeeklySummary() {
    const records = getRecords();
    const dates = Object.keys(records)
        .filter(date => {
            const diff = getDaysDiff(date);
            return diff >= 0 && diff <= 6;
        });

    const stats = buildPeriodStats(records, dates);

    setText("weeklyAvgSleep", averageText(stats.sleepValues, "時間"));
    setText("weeklyAvgEfficiency", averageText(stats.efficiencyValues, "%"));
    setText("weeklyStudyTotal", stats.studyTotal > 0 ? `${stats.studyTotal}分` : "未計算");
    setText("weeklyAvgFocus", averageText(stats.focusValues, ""));
}

function updateAchievementSummary() {
    const records = getRecords();
    const dates = Object.keys(records)
        .filter(date => {
            const diff = getDaysDiff(date);
            return diff >= 0 && diff <= 6;
        });

    const stats = buildPeriodStats(records, dates);

    const avgBedtimeGap = averageNumber(stats.bedtimeGaps);
    const avgWakeTimeGap = averageNumber(stats.wakeTimeGaps);

    const timeInBedGaps = [];

    dates.forEach(date => {
        const achievement = calculateAchievementFromRecord(records[date]);

        if (achievement && achievement.timeInBedGap !== null) {
            timeInBedGaps.push(achievement.timeInBedGap);
        }
    });

    const avgTimeInBedGap = averageNumber(timeInBedGaps);

    setGapSummary("weeklyAvgBedtimeGap", avgBedtimeGap);
    setGapSummary("weeklyAvgWakeTimeGap", avgWakeTimeGap);
    setGapSummary("weeklyAvgTimeInBedGap", avgTimeInBedGap);

    const achievementElement = document.getElementById("weeklyAchievementRate");

    if (achievementElement) {
        achievementElement.classList.remove("good", "warning", "danger");

        if (stats.achievementRate === null) {
            achievementElement.textContent = "未計算";
        } else {
            achievementElement.textContent = `${stats.achievementRate.toFixed(0)}%`;
            setSummaryClass(achievementElement, stats.achievementRate, "achievement");
        }
    }
}

function setGapSummary(id, value) {
    const element = document.getElementById(id);

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
                handleRatingButtonClick(field.id, String(value));
            });

            container.appendChild(button);
        }
    });

    updateRatingDisplays();
}

function handleRatingButtonClick(fieldId, value) {
    const input = document.getElementById(fieldId);

    if (!input) {
        return;
    }

    if (input.value === value) {
        input.value = "";
    } else {
        input.value = value;
    }

    updateRatingDisplays();
    saveCurrentRecord();
}

function updateRatingDisplays() {
    ratingFields.forEach(field => {
        const input = document.getElementById(field.id);
        const display = document.getElementById(`${field.id}Display`);
        const buttons = document.querySelectorAll(`.rating-button[data-target="${field.id}"]`);

        const value = input ? input.value : "";

        if (display) {
            display.textContent = value ? `${value} / 10` : "未入力";
        }

        buttons.forEach(button => {
            if (button.dataset.value === value) {
                button.classList.add("selected");
            } else {
                button.classList.remove("selected");
            }
        });
    });
}

// ==============================
// 記録状況・カレンダー・履歴
// ==============================

function getRecordCompleteness(record) {
    if (!record) {
        return "none";
    }

    const hasActualSleep =
        Boolean(record.bedtime) ||
        Boolean(record.wakeTime) ||
        Boolean(record.sleepHours) ||
        Boolean(record.awakeCount);

    const hasCondition =
        Boolean(record.mood) ||
        Boolean(record.sleepiness) ||
        Boolean(record.fatigue) ||
        Boolean(record.focus);

    const hasStudy =
        Boolean(record.studyTotal) ||
        Boolean(record.mainSubject);

    const hasWork =
        Boolean(record.workType);

    const hasMemo =
        Boolean(record.memo && record.memo.trim() !== "");

    const categoryCount = [
        hasActualSleep,
        hasCondition,
        hasStudy,
        hasWork,
        hasMemo
    ].filter(Boolean).length;

    if (categoryCount === 0) {
        return "none";
    }

    if (categoryCount >= 2) {
        return "full";
    }

    return "partial";
}

function getCompletenessLabel(completeness) {
    if (completeness === "full") {
        return "十分";
    }

    if (completeness === "partial") {
        return "一部";
    }

    return "なし";
}

function renderRecordCalendar() {
    const calendar = document.getElementById("recordCalendar");

    if (!calendar) {
        return;
    }

    const records = getRecords();
    const todayText = getTodayString();

    calendar.innerHTML = "";

    for (let offset = 29; offset >= 0; offset--) {
        const dateText = addDays(todayText, -offset);
        const record = records[dateText];
        const completeness = getRecordCompleteness(record);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `calendar-day ${completeness}`;
        button.title = `${dateText}：${getCompletenessLabel(completeness)}`;

        if (dateText === todayText) {
            button.classList.add("today");
        }

        if (dateText === currentDate) {
            button.classList.add("selected");
        }

        const dateSpan = document.createElement("span");
        dateSpan.className = "calendar-day-number";
        dateSpan.textContent = formatShortDate(dateText);

        const labelSpan = document.createElement("span");
        labelSpan.className = "calendar-day-label";
        labelSpan.textContent = getCompletenessLabel(completeness);

        button.appendChild(dateSpan);
        button.appendChild(labelSpan);

        button.addEventListener("click", () => {
            const dateElement = document.getElementById("recordDate");

            if (dateElement) {
                dateElement.value = dateText;
            }

            loadRecord(dateText);
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
    const historyList = document.getElementById("historyList");

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
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-item";

        if (date === currentDate) {
            button.classList.add("active");
        }

        const record = records[date];
        const completeness = getRecordCompleteness(record);
        button.classList.add(completeness);

        const efficiency = calculateSleepEfficiencyFromRecord(record);
        const achievement = calculateAchievementFromRecord(record);

        const sleepText = record.sleepHours
            ? `実睡眠 ${record.sleepHours}h`
            : "実睡眠 未入力";

        const efficiencyText = efficiency !== null
            ? `効率 ${efficiency.toFixed(1)}%`
            : "効率 未計算";

        const studyText = record.studyTotal
            ? `勉強 ${record.studyTotal}分`
            : "勉強 未入力";

        const workText = record.workType
            ? `勤務 ${record.workType}`
            : "勤務 未入力";

        const conditionText =
            record.mood || record.sleepiness || record.fatigue || record.focus
                ? `体調 気分${record.mood || "-"} 眠気${record.sleepiness || "-"} 疲労${record.fatigue || "-"} 集中${record.focus || "-"}`
                : "体調 未入力";

        const planText =
            record.plannedBedtime && record.plannedWakeTime
                ? `予定 ${record.plannedBedtime}-${formatTimeWithNextDay(record.plannedBedtime, record.plannedWakeTime)}`
                : "予定 未入力";

        const bedtimeGapText =
            achievement && achievement.bedtimeGap !== null
                ? `就寝ズレ ${formatGapMinutes(achievement.bedtimeGap)}`
                : "就寝ズレ 未計算";

        const wakeGapText =
            achievement && achievement.wakeTimeGap !== null
                ? `起床ズレ ${formatGapMinutes(achievement.wakeTimeGap)}`
                : "起床ズレ 未計算";

        const achievementClass =
            achievement && achievement.canJudgeAchievement && achievement.achieved
                ? "good"
                : achievement && achievement.canJudgeAchievement
                    ? "warning"
                    : "";

        const achievementText =
            achievement && achievement.canJudgeAchievement && achievement.achieved
                ? "予定達成"
                : achievement && achievement.canJudgeAchievement
                    ? "予定未達"
                    : "予定判定 未計算";

        button.innerHTML = `
            <span class="history-date">${date}　${getCompletenessLabel(completeness)}記録</span>
            <span class="history-detail">${planText}</span>
            <span class="history-detail">${sleepText}　${efficiencyText}</span>
            <span class="history-detail ${achievementClass}">${bedtimeGapText}　${wakeGapText}　${achievementText}</span>
            <span class="history-detail">${conditionText}</span>
            <span class="history-detail">${studyText}　${workText}</span>
        `;

        button.addEventListener("click", () => {
            const dateElement = document.getElementById("recordDate");

            if (dateElement) {
                dateElement.value = date;
            }

            loadRecord(date);
        });

        historyList.appendChild(button);
    });
}

function setupHistoryFilterEvents() {
    const buttons = document.querySelectorAll(".filter-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            historyFilter = button.dataset.filter;

            buttons.forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            renderHistory();
        });
    });
}

// ==============================
// 削除・バックアップ
// ==============================

function updateDeleteButton() {
    const button = document.getElementById("deleteRecordButton");
    const dateElement = document.getElementById("recordDate");

    if (!button || !dateElement) {
        return;
    }

    const records = getRecords();
    const date = dateElement.value;

    button.disabled = !records[date];
}

function deleteCurrentRecord() {
    const dateElement = document.getElementById("recordDate");

    if (!dateElement || !dateElement.value) {
        return;
    }

    const date = dateElement.value;
    const records = getRecords();

    if (!records[date]) {
        updateSaveStatus(`削除する記録がありません：${date}`, false);
        return;
    }

    const confirmed = window.confirm(`${date} の記録を削除しますか？`);

    if (!confirmed) {
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

    console.log("削除しました", date);
}

function exportData() {
    const records = getRecords();
    const settings = getSettings();

    const backupData = {
        appName: "CPA Life Analyzer",
        version: "4.5",
        exportedAt: new Date().toISOString(),
        settings,
        records
    };

    const jsonText = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const fileName = `cpa-life-analyzer-backup-${getTodayString()}.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);

    updateSaveStatus(`バックアップを作成しました：${fileName}`, false);
}

function normalizeImportedRecords(importedData) {
    if (!importedData) {
        return null;
    }

    if (
        importedData.records &&
        typeof importedData.records === "object" &&
        !Array.isArray(importedData.records)
    ) {
        return importedData.records;
    }

    if (typeof importedData === "object" && !Array.isArray(importedData)) {
        return importedData;
    }

    return null;
}

function normalizeImportedSettings(importedData) {
    if (
        importedData &&
        importedData.settings &&
        typeof importedData.settings === "object" &&
        !Array.isArray(importedData.settings)
    ) {
        return {
            defaultPlannedBedtime: importedData.settings.defaultPlannedBedtime || "",
            defaultPlannedWakeTime: importedData.settings.defaultPlannedWakeTime || ""
        };
    }

    return null;
}

function importDataFromFile(file) {
    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = event => {
        try {
            const importedData = JSON.parse(event.target.result);
            const importedRecords = normalizeImportedRecords(importedData);
            const importedSettings = normalizeImportedSettings(importedData);

            if (!importedRecords) {
                window.alert("復元できません。JSONの形式が正しくありません。");
                return;
            }

            const count = Object.keys(importedRecords).length;

            const confirmed = window.confirm(
                `JSONファイルから ${count} 件の記録を復元します。\n現在のデータは上書きされます。\n実行しますか？`
            );

            if (!confirmed) {
                return;
            }

            setRecords(importedRecords);

            if (importedSettings) {
                setSettings(importedSettings);
                loadSettingsToForm();
            }

            const dateElement = document.getElementById("recordDate");
            const records = getRecords();
            const dates = Object.keys(records).sort().reverse();

            const nextDate = dates[0] || getTodayString();

            if (dateElement) {
                dateElement.value = nextDate;
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

function setupBackupEvents() {
    const exportButton = document.getElementById("exportButton");
    const importFile = document.getElementById("importFile");

    if (exportButton) {
        exportButton.addEventListener("click", exportData);
    }

    if (importFile) {
        importFile.addEventListener("change", event => {
            const file = event.target.files[0];
            importDataFromFile(file);
            event.target.value = "";
        });
    }
}

function setupInputEvents() {
    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("input", () => {
                updateRatingDisplays();
                saveCurrentRecord();
            });

            element.addEventListener("change", () => {
                updateRatingDisplays();
                saveCurrentRecord();
            });
        }
    });
}

function setupDateEvent() {
    const dateElement = document.getElementById("recordDate");

    if (!dateElement) {
        return;
    }

    dateElement.addEventListener("change", () => {
        const newDate = dateElement.value;

        if (!newDate) {
            return;
        }

        loadRecord(newDate);
    });
}

function setupDeleteEvent() {
    const button = document.getElementById("deleteRecordButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", deleteCurrentRecord);
}

function setupSettingsEvents() {
    const button = document.getElementById("saveSettingsButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", saveSettingsFromForm);
}

// ==============================
// 初期化
// ==============================

window.addEventListener("load", () => {
    const dateElement = document.getElementById("recordDate");

    if (!dateElement) {
        console.error("recordDate が見つかりません");
        return;
    }

    loadSettingsToForm();
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
    updateCharts();
    updateAutoAlerts();
    updateCorrelationAnalysis();

    console.log("初期化完了");
});