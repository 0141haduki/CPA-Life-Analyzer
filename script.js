// CPA Life Analyzer v4.1

console.log("CPA Life Analyzer v4.1 起動");

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
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

    const diffMs = today - target;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

    renderHistory();
    renderRecordCalendar();
    updateWeeklySummary();
    updateAchievementSummary();
    updateDeleteButton();
    updateCharts();

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
    renderHistory();
    renderRecordCalendar();
    updateWeeklySummary();
    updateAchievementSummary();
    updateDeleteButton();
    updateCharts();
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
    if (minutes === null) {
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

function setSummaryClass(element, value, type) {
    if (!element) {
        return;
    }

    element.classList.remove("good", "warning", "danger");

    if (value === null) {
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
    const record = getFormData();
    return calculateSleepEfficiencyFromRecord(record);
}

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

    const limitedItems = adviceItems.slice(0, 5);

    main.textContent = mainText;
    list.innerHTML = "";

    limitedItems.forEach(item => {
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
        buildWeeklySummaryText(records),
        "",
        buildThirtyDaySummaryText(records),
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
        buildThirtyDaySummaryText(records),
        "",
        buildMonthlySummaryText(records),
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
        buildWeeklySummaryText(records),
        "",
        buildThirtyDaySummaryText(records),
        "",
        buildSubjectSummaryText(records, 30),
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

    const text = buildAiConsultTextByType(consultType, date, record, records);

    textarea.value = text;

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
        labels: labels,
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
        labels: labels,
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
        labels: labels,
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
        labels: labels,
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

function averageNumber(values) {
    if (values.length === 0) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
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

function averageText(values, unit) {
    if (values.length === 0) {
        return "未計算";
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    const average = total / values.length;

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
    renderHistory();
    renderRecordCalendar();
    updateWeeklySummary();
    updateAchievementSummary();
    updateDeleteButton();
    updateCharts();

    console.log("削除しました", date);
}

function exportData() {
    const records = getRecords();
    const settings = getSettings();

    const backupData = {
        appName: "CPA Life Analyzer",
        version: "4.1",
        exportedAt: new Date().toISOString(),
        settings: settings,
        records: records
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
            updateCharts();
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

    updateRatingDisplays();
    updateTodayAdvice();
    renderRecordCalendar();
    updateDeleteButton();
    updateWeeklySummary();
    updateAchievementSummary();
    updateSettingsStatus();
    updateCharts();

    console.log("初期化完了");
});