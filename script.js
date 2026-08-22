// CPA Life Analyzer v3.0

console.log("CPA Life Analyzer v3.0 起動");

// localStorageに保存するキー
const STORAGE_KEY = "CPA_LIFE_ANALYZER_RECORDS_V2";
const LAST_DATE_KEY = "CPA_LIFE_ANALYZER_LAST_DATE_V2";
const SETTINGS_KEY = "CPA_LIFE_ANALYZER_SETTINGS_V2";

// 日付以外の入力項目
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

// 体調評価ボタンの項目
const ratingFields = [
    {
        id: "mood",
        label: "気分"
    },
    {
        id: "sleepiness",
        label: "眠気"
    },
    {
        id: "fatigue",
        label: "疲労"
    },
    {
        id: "focus",
        label: "集中力"
    }
];

// 現在選択中の日付
let currentDate = "";

// 履歴表示フィルター
let historyFilter = "7";

// 今日の日付を YYYY-MM-DD 形式で取得
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// 現在時刻を HH:MM 形式で取得
function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

// YYYY-MM-DD を Date に変換
function dateStringToDate(dateText) {
    const parts = dateText.split("-").map(Number);

    if (parts.length !== 3) {
        return null;
    }

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    if (!year || !month || !day) {
        return null;
    }

    return new Date(year, month - 1, day);
}

// Date を YYYY-MM-DD に変換
function dateToString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// 日付に日数を足す
function addDays(dateText, days) {
    const date = dateStringToDate(dateText);

    if (!date) {
        return dateText;
    }

    date.setDate(date.getDate() + days);
    return dateToString(date);
}

// MM/DD 表示
function formatShortDate(dateText) {
    const parts = dateText.split("-");

    if (parts.length !== 3) {
        return dateText;
    }

    return `${Number(parts[1])}/${Number(parts[2])}`;
}

// 日付差を計算
function getDaysDiff(dateText) {
    const today = dateStringToDate(getTodayString());
    const target = dateStringToDate(dateText);

    if (!today || !target) {
        return 99999;
    }

    const diffMs = today - target;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// 全記録を取得
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

// 全記録を保存
function setRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// 設定を取得
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

// 設定を保存
function setSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 設定欄に反映
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

// 基本睡眠予定を保存
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

// 設定保存状態を表示
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

// 基本予定を今日の予定欄へ反映
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

// 画面の入力内容を取得
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

// 画面にデータを反映
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

// 入力欄を空にする
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

// 現在の日付のデータを保存
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

    console.log("保存しました", date, records[date]);
}

// 指定した日付のデータを読み込む
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
}

// 保存状態を表示
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

// 時刻から分に変換
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

// 在床時間を計算
function calculateTimeInBedHours(bedtime, wakeTime) {
    const bedMinutes = timeToMinutes(bedtime);
    const wakeMinutes = timeToMinutes(wakeTime);

    if (bedMinutes === null || wakeMinutes === null) {
        return null;
    }

    let diffMinutes = wakeMinutes - bedMinutes;

    // 起床時刻が就寝時刻より早い場合は、日付をまたいだ睡眠として扱う
    if (diffMinutes <= 0) {
        diffMinutes += 24 * 60;
    }

    return diffMinutes / 60;
}

// 時刻のズレを分で計算
function calculateClockGapMinutes(plannedTime, actualTime) {
    const plannedMinutes = timeToMinutes(plannedTime);
    const actualMinutes = timeToMinutes(actualTime);

    if (plannedMinutes === null || actualMinutes === null) {
        return null;
    }

    let diff = actualMinutes - plannedMinutes;

    // 日付またぎを考慮して、-12時間〜+12時間の範囲に補正
    if (diff > 720) {
        diff -= 1440;
    }

    if (diff < -720) {
        diff += 1440;
    }

    return diff;
}

// 分を表示用に変換
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

// サマリー値に色をつける
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

// 記録データから睡眠効率を計算
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

// 記録データから予定達成情報を計算
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

// 現在画面の睡眠効率を計算
function calculateSleepEfficiency() {
    const record = getFormData();
    return calculateSleepEfficiencyFromRecord(record);
}

// 睡眠サマリーを更新
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

// 数値入力の範囲チェック
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

// 現在の入力内容をチェック
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

// 入力チェック欄を更新
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

// 数値として使えるか確認
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

// 今日のアドバイスを更新
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

    // 睡眠時間による判断
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

    // 睡眠効率による判断
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

    // 予定ズレによる判断
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

    // 体調による判断
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

    // 勉強時間による判断
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

    // 勤務による判断
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

    // 主科目による補足
    if (record.mainSubject) {
        adviceItems.push({
            text: `主科目は「${record.mainSubject}」です。明日以降の分析で、睡眠や集中力との相性を見ていきます。`,
            className: "priority-good"
        });
    }

    // 全体判定
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

    // 最大5件に絞る
    const limitedItems = adviceItems.slice(0, 5);

    main.textContent = mainText;
    list.innerHTML = "";

    limitedItems.forEach(item => {
        addAdviceItem(list, item.text, item.className);
    });
}

// アドバイス項目を追加
function addAdviceItem(list, text, className) {
    const item = document.createElement("li");
    item.textContent = text;

    if (className) {
        item.classList.add(className);
    }

    list.appendChild(item);
}

// 計算表示をまとめて更新
function updateAllCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
    updateTodayAdvice();
}

// 直近7日サマリーを更新
function updateWeeklySummary() {
    const records = getRecords();
    const dates = Object.keys(records)
        .filter(date => {
            const diff = getDaysDiff(date);
            return diff >= 0 && diff <= 6;
        });

    const sleepValues = [];
    const efficiencyValues = [];
    const focusValues = [];
    let studyTotal = 0;
    let hasStudyData = false;

    dates.forEach(date => {
        const record = records[date];

        const sleepHours = getNumberOrNull(record.sleepHours);
        if (sleepHours !== null) {
            sleepValues.push(sleepHours);
        }

        const efficiency = calculateSleepEfficiencyFromRecord(record);
        if (efficiency !== null && efficiency <= 100) {
            efficiencyValues.push(efficiency);
        }

        const focus = getNumberOrNull(record.focus);
        if (focus !== null) {
            focusValues.push(focus);
        }

        const study = getNumberOrNull(record.studyTotal);
        if (study !== null) {
            studyTotal += study;
            hasStudyData = true;
        }
    });

    setText("weeklyAvgSleep", averageText(sleepValues, "時間"));
    setText("weeklyAvgEfficiency", averageText(efficiencyValues, "%"));
    setText("weeklyStudyTotal", hasStudyData ? `${studyTotal}分` : "未計算");
    setText("weeklyAvgFocus", averageText(focusValues, ""));
}

// 予定達成分析を更新
function updateAchievementSummary() {
    const records = getRecords();
    const dates = Object.keys(records)
        .filter(date => {
            const diff = getDaysDiff(date);
            return diff >= 0 && diff <= 6;
        });

    const bedtimeGaps = [];
    const wakeTimeGaps = [];
    const timeInBedGaps = [];

    let achievementTargetCount = 0;
    let achievedCount = 0;

    dates.forEach(date => {
        const record = records[date];
        const achievement = calculateAchievementFromRecord(record);

        if (!achievement) {
            return;
        }

        if (achievement.bedtimeGap !== null) {
            bedtimeGaps.push(achievement.bedtimeGap);
        }

        if (achievement.wakeTimeGap !== null) {
            wakeTimeGaps.push(achievement.wakeTimeGap);
        }

        if (achievement.timeInBedGap !== null) {
            timeInBedGaps.push(achievement.timeInBedGap);
        }

        if (achievement.canJudgeAchievement) {
            achievementTargetCount += 1;

            if (achievement.achieved) {
                achievedCount += 1;
            }
        }
    });

    const avgBedtimeGap = averageNumber(bedtimeGaps);
    const avgWakeTimeGap = averageNumber(wakeTimeGaps);
    const avgTimeInBedGap = averageNumber(timeInBedGaps);

    const achievementRate =
        achievementTargetCount === 0
            ? null
            : achievedCount / achievementTargetCount * 100;

    setGapSummary("weeklyAvgBedtimeGap", avgBedtimeGap);
    setGapSummary("weeklyAvgWakeTimeGap", avgWakeTimeGap);
    setGapSummary("weeklyAvgTimeInBedGap", avgTimeInBedGap);

    const achievementElement = document.getElementById("weeklyAchievementRate");

    if (achievementElement) {
        achievementElement.classList.remove("good", "warning", "danger");

        if (achievementRate === null) {
            achievementElement.textContent = "未計算";
        } else {
            achievementElement.textContent = `${achievementRate.toFixed(0)}%`;
            setSummaryClass(achievementElement, achievementRate, "achievement");
        }
    }
}

// 平均値を数値で返す
function averageNumber(values) {
    if (values.length === 0) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
}

// ズレの平均を表示
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

// 平均値の表示
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

// テキストを設定
function setText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

// 体調評価ボタンを作成
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

// 体調評価ボタンを押したときの処理
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

// 体調評価ボタンの表示を更新
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

// 記録状況を判定
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

// 記録状況ラベル
function getCompletenessLabel(completeness) {
    if (completeness === "full") {
        return "十分";
    }

    if (completeness === "partial") {
        return "一部";
    }

    return "なし";
}

// 直近30日の記録状況カレンダーを表示
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

// 履歴フィルターに応じて日付を絞る
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

// 履歴一覧を表示
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
                ? `予定 ${record.plannedBedtime}-${record.plannedWakeTime}`
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

// 履歴フィルターのイベントを設定
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

// 削除ボタンの状態を更新
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

// 現在の日付の記録を削除
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

    console.log("削除しました", date);
}

// バックアップファイルをダウンロード
function exportData() {
    const records = getRecords();
    const settings = getSettings();

    const backupData = {
        appName: "CPA Life Analyzer",
        version: "3.0",
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

// 復元データの形式チェック
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

// 復元データから設定を取得
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

// JSONファイルから復元
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

// バックアップ・復元イベントを設定
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

// 入力イベントを設定
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

// 日付変更イベントを設定
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

// 削除イベントを設定
function setupDeleteEvent() {
    const button = document.getElementById("deleteRecordButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", deleteCurrentRecord);
}

// 設定イベントを設定
function setupSettingsEvents() {
    const button = document.getElementById("saveSettingsButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", saveSettingsFromForm);
}

// 初期化
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

    updateRatingDisplays();
    updateTodayAdvice();
    renderRecordCalendar();
    updateDeleteButton();
    updateWeeklySummary();
    updateAchievementSummary();
    updateSettingsStatus();

    console.log("初期化完了");
});