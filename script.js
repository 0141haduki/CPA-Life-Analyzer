// CPA Life Analyzer v2

console.log("CPA Life Analyzer v2 起動");

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
}

// 入力欄を空にする
function clearForm() {
    fieldIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.value = "";
        }
    });
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

    updateSaveStatus(`保存しました：${date}`);
    renderHistory();

    console.log("保存しました", date, records[date]);
}

// 指定した日付のデータを読み込む
function loadRecord(date) {
    const records = getRecords();

    clearForm();

    if (records[date]) {
        setFormData(records[date]);
        updateSaveStatus(`読み込みました：${date}`);
    } else {
        updateSaveStatus(`新しい記録です：${date}`);
    }

    localStorage.setItem(LAST_DATE_KEY, date);
    currentDate = date;

    renderHistory();
}

// 保存状態を表示
function updateSaveStatus(message) {
    const status = document.getElementById("saveStatus");

    if (status) {
        status.textContent = message;
    }
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

        const sleepText = record.sleepHours
            ? `睡眠 ${record.sleepHours}時間`
            : "睡眠 未入力";

        const studyText = record.studyTotal
            ? `勉強 ${record.studyTotal}分`
            : "勉強 未入力";

        button.textContent = `${date}　${sleepText}　${studyText}`;

        button.addEventListener("click", () => {
            const dateElement = document.getElementById("recordDate");
            dateElement.value = date;
            loadRecord(date);
        });

        historyList.appendChild(button);
    });
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

    console.log("初期化完了");
});