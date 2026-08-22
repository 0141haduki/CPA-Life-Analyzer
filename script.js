// CPA Life Analyzer v2.4

console.log("CPA Life Analyzer v2.4 起動");

// localStorageに保存するキー
const STORAGE_KEY = "CPA_LIFE_ANALYZER_RECORDS_V2";
const LAST_DATE_KEY = "CPA_LIFE_ANALYZER_LAST_DATE_V2";

// 日付以外の入力項目
const fieldIds = [
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

// 現在選択中の日付
let currentDate = "";

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

// 全記録を取得
function getRecords() {
    const text = localStorage.getItem(STORAGE_KEY);

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("データの読み込みに失敗しました", error);
        return {};
    }
}

// 全記録を保存
function setRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.value = data[id] ?? "";
        }
    });

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
        updateSaveStatus(`新しい記録です：${date}`, false);
    }

    localStorage.setItem(LAST_DATE_KEY, date);
    currentDate = date;

    updateAllCalculatedDisplays();
    renderHistory();
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

// 睡眠効率を計算
function calculateSleepEfficiency() {
    const bedtime = document.getElementById("bedtime")?.value;
    const wakeTime = document.getElementById("wakeTime")?.value;
    const sleepHoursText = document.getElementById("sleepHours")?.value;

    const timeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
    const sleepHours = Number(sleepHoursText);

    if (
        timeInBedHours === null ||
        !sleepHoursText ||
        Number.isNaN(sleepHours) ||
        sleepHours <= 0 ||
        timeInBedHours <= 0
    ) {
        return null;
    }

    return sleepHours / timeInBedHours * 100;
}

// 睡眠サマリーを更新
function updateSleepSummary() {
    const bedtime = document.getElementById("bedtime")?.value;
    const wakeTime = document.getElementById("wakeTime")?.value;
    const timeInBedElement = document.getElementById("timeInBed");
    const efficiencyElement = document.getElementById("sleepEfficiency");

    const timeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
    const efficiency = calculateSleepEfficiency();

    if (timeInBedElement) {
        if (timeInBedHours === null) {
            timeInBedElement.textContent = "未計算";
        } else {
            timeInBedElement.textContent = `${timeInBedHours.toFixed(1)}時間`;
        }
    }

    if (efficiencyElement) {
        efficiencyElement.classList.remove("warning", "danger");

        if (efficiency === null) {
            efficiencyElement.textContent = "未計算";
            return;
        }

        if (efficiency > 100) {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}% 要確認`;
            efficiencyElement.classList.add("danger");
        } else if (efficiency < 70) {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}% 低め`;
            efficiencyElement.classList.add("warning");
        } else {
            efficiencyElement.textContent = `${efficiency.toFixed(1)}%`;
        }
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

    const bedtime = document.getElementById("bedtime")?.value;
    const wakeTime = document.getElementById("wakeTime")?.value;
    const sleepHoursText = document.getElementById("sleepHours")?.value;
    const awakeCountText = document.getElementById("awakeCount")?.value;
    const moodText = document.getElementById("mood")?.value;
    const sleepinessText = document.getElementById("sleepiness")?.value;
    const fatigueText = document.getElementById("fatigue")?.value;
    const focusText = document.getElementById("focus")?.value;
    const studyTotalText = document.getElementById("studyTotal")?.value;

    const timeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
    const sleepHours = Number(sleepHoursText);
    const awakeCount = Number(awakeCountText);
    const studyTotal = Number(studyTotalText);

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

            if (timeInBedHours !== null && sleepHours > timeInBedHours) {
                warnings.push("実睡眠時間が在床時間を超えています。入力値を確認してください");
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

// 計算表示をまとめて更新
function updateAllCalculatedDisplays() {
    updateSleepSummary();
    updateWarnings();
}

// 履歴一覧を表示
function renderHistory() {
    const historyList = document.getElementById("historyList");

    if (!historyList) {
        return;
    }

    const records = getRecords();
    const dates = Object.keys(records).sort().reverse();

    historyList.innerHTML = "";

    if (dates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "まだ記録がありません";
        historyList.appendChild(empty);
        return;
    }

    dates.forEach(date => {
        const button = document.createElement("button");
        button.className = "history-item";

        if (date === currentDate) {
            button.classList.add("active");
        }

        const record = records[date];

        const bedtime = record.bedtime || "";
        const wakeTime = record.wakeTime || "";
        const timeInBedHours = calculateTimeInBedHours(bedtime, wakeTime);
        const sleepHoursText = record.sleepHours || "";
        const sleepHours = Number(sleepHoursText);

        let efficiencyText = "効率 未計算";

        if (
            timeInBedHours !== null &&
            sleepHoursText !== "" &&
            !Number.isNaN(sleepHours) &&
            sleepHours > 0
        ) {
            const efficiency = sleepHours / timeInBedHours * 100;
            efficiencyText = `効率 ${efficiency.toFixed(1)}%`;
        }

        const sleepText = record.sleepHours
            ? `実睡眠 ${record.sleepHours}h`
            : "実睡眠 未入力";

        const studyText = record.studyTotal
            ? `勉強 ${record.studyTotal}分`
            : "勉強 未入力";

        const workText = record.workType
            ? `勤務 ${record.workType}`
            : "勤務 未入力";

        button.textContent = `${date}　${sleepText}　${efficiencyText}　${studyText}　${workText}`;

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
    currentDate = date;
    localStorage.setItem(LAST_DATE_KEY, date);

    updateSaveStatus(`削除しました：${date}`, false);
    renderHistory();
    updateDeleteButton();

    console.log("削除しました", date);
}

// 入力イベントを設定
function setupInputEvents() {
    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("input", saveCurrentRecord);
            element.addEventListener("change", saveCurrentRecord);
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

// 初期化
window.addEventListener("load", () => {
    const dateElement = document.getElementById("recordDate");

    if (!dateElement) {
        console.error("recordDate が見つかりません");
        return;
    }

    const lastDate = localStorage.getItem(LAST_DATE_KEY);
    const startDate = lastDate || getTodayString();

    dateElement.value = startDate;
    currentDate = startDate;

    loadRecord(startDate);
    setupInputEvents();
    setupDateEvent();
    setupDeleteEvent();
    updateDeleteButton();

    console.log("初期化完了");
});