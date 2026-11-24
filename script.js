let myActivities = [];
let editIndex = -1; 
let currentDueActivity = null; 

const intro = document.getElementById("intro");
intro.textContent = "Daily Moves: Mapped and Planned.";

const activityInput = document.getElementById("activity");
const activityDateInput = document.getElementById("activity-date");
const activityForm = document.getElementById("activity-form");

// Default the date input to today
if (activityDateInput) {
    activityDateInput.value = getTodayDateString();
}

// --- DARK MODE TOGGLE LOGIC ---
const themeToggleBtn = document.getElementById("theme-toggle");
const body = document.body;

if (localStorage.getItem("theme") === "dark") {
    body.classList.add("dark-mode");
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function() {
        body.classList.toggle("dark-mode");
        if (body.classList.contains("dark-mode")) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
    });
}

function showToast(message) {
    const toast = document.getElementById("toast-message");
    if (toast) {
        toast.textContent = message;
        toast.classList.add("show"); 
        setTimeout(function() { toast.classList.remove("show"); }, 3000);
    }
}

// --- NOTIFICATION & SOUND FUNCTIONS ---
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); 
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); 
        
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) { console.log("Sound play prevented:", error); }
}

function sendNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⏰ Reminder: " + title, {
            body: body || "It's time for this activity!",
            icon: "favicon.ico"
        });
    }
    playNotificationSound();
}

function openModal(activity) {
    currentDueActivity = activity;
    document.getElementById("modal-title").textContent = "⏰ Time for: " + activity.name;
    document.getElementById("modal-desc").textContent = activity.description || "No description provided.";
    document.getElementById("snooze-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("snooze-modal").classList.add("hidden");
    currentDueActivity = null;
}

// Shared helper to complete single or recurring activities
function completeActivity(activity) {
    const repeat = activity.repeat || "None";
    activity.isCompleted = true;

    if (repeat !== "None") {
        const [y, m, d] = activity.date.split('-').map(Number);
        const currentDateObj = new Date(y, m - 1, d);

        if (repeat === "Daily") {
            currentDateObj.setDate(currentDateObj.getDate() + 1);
        } else if (repeat === "Weekly") {
            currentDateObj.setDate(currentDateObj.getDate() + 7);
        } else if (repeat === "Monthly") {
            currentDateObj.setMonth(currentDateObj.getMonth() + 1);
        }

        const nextYear = currentDateObj.getFullYear();
        const nextMonth = String(currentDateObj.getMonth() + 1).padStart(2, '0');
        const nextDay = String(currentDateObj.getDate()).padStart(2, '0');
        const nextDateString = `${nextYear}-${nextMonth}-${nextDay}`;

        myActivities.push({
            name: activity.name,
            date: nextDateString,
            time: activity.time,
            priority: activity.priority,
            description: activity.description,
            repeat: activity.repeat,
            isCompleted: false,
            notified: false
        });
        showToast("Done! Next occurrence scheduled for " + nextDateString);
    } else {
        showToast("Activity marked as done!");
    }

    localStorage.setItem("savedActivities", JSON.stringify(myActivities));
    redrawAll();
}

function markActivityDone() {
    if (currentDueActivity) {
        const activity = currentDueActivity;
        closeModal();
        completeActivity(activity);
    }
}

function snoozeActivity(minutes) {
    if (!currentDueActivity) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    
    const newHours = now.getHours().toString().padStart(2, '0');
    const newMinutes = now.getMinutes().toString().padStart(2, '0');
    const newTime24 = newHours + ':' + newMinutes;
    const newTime12 = convertTo12Hour(newTime24);
    
    currentDueActivity.time = newTime12;
    currentDueActivity.notified = false; 
    
    localStorage.setItem("savedActivities", JSON.stringify(myActivities));
    closeModal();
    redrawAll();
    showToast("Snoozed for " + minutes + " minutes!");
}

function checkForNotifications() {
    const now = new Date();
    const todayString = getTodayDateString(); 
    
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime24 = currentHours + ':' + currentMinutes;

    myActivities.forEach(function(activity) {
        if (activity.date === todayString && !activity.isCompleted && !activity.notified && activity.time) {
            const activityTime24 = convertTo24Hour(activity.time);
            if (activityTime24 === currentTime24) {
                sendNotification(activity.name, activity.description);
                openModal(activity); 
                activity.notified = true;
                localStorage.setItem("savedActivities", JSON.stringify(myActivities));
            }
        }
    });
}

setInterval(checkForNotifications, 15000);
checkForNotifications(); 

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function convertTo12Hour(time24) {
    if (!time24) return ""; 
    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; 
    return hour + ':' + minutes + ' ' + period;
}

function convert12HourToInputTime(time12) {
    if (!time12) return "";
    const [time, period] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours.toString().padStart(2, '0') + ':' + minutes;
}

function convertTo24Hour(time12) {
    if (!time12) return "00:00";
    const [time, period] = time12.split(' ');
    let [hours, minutes] = time.split(':');
    if (period === 'PM' && hours !== '12') hours = parseInt(hours) + 12;
    else if (period === 'AM' && hours === '12') hours = '00';
    return hours.toString().padStart(2, '0') + ':' + minutes;
}

function sortActivities(activities) {
    return activities.sort(function(a, b) {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        const timeA = convertTo24Hour(a.time);
        const timeB = convertTo24Hour(b.time);
        if (timeA < timeB) return -1;
        if (timeA > timeB) return 1;
        return 0;
    });
}

function toggleClearButton() {
    const hasCompleted = myActivities.some(act => act.isCompleted);
    const btn = document.getElementById("clear-completed-btn");
    if (btn) {
        btn.style.display = hasCompleted ? "block" : "none";
    }
}

function updateStats() {
    const todayString = getTodayDateString();
    const uncompleted = myActivities.filter(act => !act.isCompleted);
    const completed = myActivities.filter(act => act.isCompleted);

    const overdueCount = uncompleted.filter(act => act.date < todayString).length;
    const todayCount = uncompleted.filter(act => act.date === todayString).length;
    const upcomingCount = uncompleted.filter(act => act.date > todayString).length;
    const completedCount = completed.length;

    document.getElementById("stat-overdue").textContent = overdueCount;
    document.getElementById("stat-today").textContent = todayCount;
    document.getElementById("stat-upcoming").textContent = upcomingCount;
    document.getElementById("stat-completed").textContent = completedCount;
}

const searchInput = document.getElementById("search-input");
const filterPriority = document.getElementById("filter-priority");

function redrawAll() {
    const overdueList = document.getElementById("overdue-list");
    const todayList = document.getElementById("today-list");
    const upcomingList = document.getElementById("upcoming-list");
    const completedList = document.getElementById("completed-list");
    
    if (overdueList) overdueList.innerHTML = "";
    if (todayList) todayList.innerHTML = "";
    if (upcomingList) upcomingList.innerHTML = "";
    if (completedList) completedList.innerHTML = "";

    const todayString = getTodayDateString();
    const uncompleted = myActivities.filter(act => !act.isCompleted);
    const completed = myActivities.filter(act => act.isCompleted);

    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedPriority = filterPriority ? filterPriority.value : "All";

    const matchesFilter = (activity) => {
        const matchesSearch = activity.name.toLowerCase().includes(searchTerm) || 
                              (activity.description && activity.description.toLowerCase().includes(searchTerm));
        const matchesPriority = selectedPriority === "All" || activity.priority === selectedPriority;
        return matchesSearch && matchesPriority;
    };

    const overdue = uncompleted.filter(act => act.date < todayString).filter(matchesFilter);
    const todaysActivities = uncompleted.filter(act => act.date === todayString).filter(matchesFilter);
    const upcomingActivities = uncompleted.filter(act => act.date > todayString).filter(matchesFilter);
    const filteredCompleted = completed.filter(matchesFilter);

    sortActivities(overdue);
    sortActivities(todaysActivities);
    sortActivities(upcomingActivities);

    overdue.forEach(function(activity) { drawActivity(activity, "overdue-list", true); });
    todaysActivities.forEach(function(activity) { drawActivity(activity, "today-list", false); });
    upcomingActivities.forEach(function(activity) { drawActivity(activity, "upcoming-list", false); });
    filteredCompleted.forEach(function(activity) { drawActivity(activity, "completed-list", false); });
    
    toggleClearButton();
    updateStats();
}

if (searchInput) searchInput.addEventListener("input", redrawAll);
if (filterPriority) filterPriority.addEventListener("change", redrawAll);

// --- EXPORT TO CSV FUNCTION ---
function exportToCSV() {
    if (myActivities.length === 0) {
        showToast("No activities to export!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Name,Date,Time,Priority,Description,Repeat,Status\n";

    myActivities.forEach(function(activity) {
        const escapeText = (text) => {
            if (!text) return "";
            return '"' + text.replace(/"/g, '""') + '"';
        };

        const todayString = getTodayDateString();
        let status = "Upcoming";
        if (activity.isCompleted) status = "Completed";
        else if (activity.date < todayString) status = "Overdue";
        else if (activity.date === todayString) status = "Today";

        const row = [
            escapeText(activity.name),
            activity.date,
            activity.time,
            activity.priority,
            escapeText(activity.description),
            activity.repeat || "None",
            status
        ].join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_scheduler_activities.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Activities exported successfully!");
}

const exportBtn = document.getElementById("export-btn");
if (exportBtn) {
    exportBtn.addEventListener("click", exportToCSV);
}

function drawActivity(activity, targetListId, isOverdue = false) {
    const name = activity.name;
    const date = activity.date;
    const time = activity.time;
    const priority = activity.priority;
    const description = activity.description;
    const isCompleted = activity.isCompleted;
    const repeat = activity.repeat || "None";

    const card = document.createElement("div");
    card.className = "activity-card";
    
    if (isCompleted) {
        card.style.opacity = "0.6";
        card.style.textDecoration = "line-through";
    } else if (isOverdue) {
        card.style.borderLeftColor = "#e67e22"; 
    }
    
    const header = document.createElement("div");
    header.className = "activity-header";
    const nameSpan = document.createElement("strong");
    nameSpan.textContent = name;
    const priorityBadge = document.createElement("span");
    priorityBadge.className = "priority-badge " + priority.toLowerCase();
    priorityBadge.textContent = priority;
    header.appendChild(nameSpan);
    header.appendChild(priorityBadge);
    
    const details = document.createElement("div");
    details.className = "activity-details";
    details.textContent = time ? `📅 ${date} at ${time}` : `📅 ${date}`;
    
    if (repeat !== "None" && !isCompleted) {
        const repeatBadge = document.createElement("span");
        repeatBadge.className = "priority-badge";
        repeatBadge.style.backgroundColor = "#9b59b6";
        repeatBadge.style.color = "white";
        repeatBadge.style.marginLeft = "5px";
        repeatBadge.textContent = "🔁 " + repeat;
        details.appendChild(repeatBadge);
    }

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "activity-buttons";
    
    const editBtn = document.createElement("button");
    editBtn.textContent = isOverdue ? "Reschedule" : "Edit";
    editBtn.className = isOverdue ? "reschedule-btn" : "edit-btn";
    editBtn.addEventListener("click", function() {
        document.getElementById("activity").value = activity.name;
        document.getElementById("activity-date").value = activity.date;
        document.getElementById("activity-time").value = convert12HourToInputTime(activity.time);
        document.getElementById("activity-description").value = activity.description || "";
        document.getElementById("priority").value = activity.priority;
        document.getElementById("repeat").value = repeat;
        
        editIndex = myActivities.indexOf(activity); 
        const submitBtn = activityForm.querySelector("button[type='submit']");
        submitBtn.textContent = isOverdue ? "Reschedule Activity" : "Update Activity";
        submitBtn.style.backgroundColor = isOverdue ? "#e67e22" : "#fdcb6e"; 
        submitBtn.style.color = "#2d3436";
        activityForm.scrollIntoView({ behavior: "smooth" });
    });
    buttonContainer.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", function() {
        const index = myActivities.indexOf(activity);
        if (index !== -1) myActivities.splice(index, 1);
        localStorage.setItem("savedActivities", JSON.stringify(myActivities));
        redrawAll();
        showToast("Activity deleted.");
    });
    buttonContainer.appendChild(deleteBtn);
    
    if (!isCompleted) {
        const doneBtn = document.createElement("button");
        doneBtn.textContent = "Done";
        doneBtn.className = "done-btn";
        doneBtn.addEventListener("click", function() {
            completeActivity(activity);
        });
        buttonContainer.appendChild(doneBtn);
    }
    
    card.appendChild(header);
    card.appendChild(details);
    
    if (description && description.trim() !== "") {
        const descDiv = document.createElement("div");
        descDiv.className = "activity-desc";
        descDiv.textContent = description;
        card.appendChild(descDiv);
    }
    
    card.appendChild(buttonContainer);
    
    const targetList = document.getElementById(targetListId);
    if (targetList) targetList.appendChild(card);
}

activityForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const activityName = activityInput.value.trim();
    const activityDate = document.getElementById("activity-date").value || getTodayDateString();
    const time24Hour = document.getElementById("activity-time").value;
    const activityTime = convertTo12Hour(time24Hour); 
    const activityPriority = document.getElementById("priority").value;
    const activityDescription = document.getElementById("activity-description").value;
    const activityRepeat = document.getElementById("repeat").value;

    if (time24Hour) {
        requestNotificationPermission();
    }

    if (editIndex !== -1) {
        const originalActivity = myActivities[editIndex];
        myActivities[editIndex] = {
            name: activityName, date: activityDate, time: activityTime,
            priority: activityPriority, description: activityDescription,
            repeat: activityRepeat,
            isCompleted: originalActivity.isCompleted,
            notified: false
        };
        editIndex = -1;
        const submitBtn = activityForm.querySelector("button[type='submit']");
        submitBtn.textContent = "Add Activity";
        submitBtn.style.backgroundColor = ""; 
        submitBtn.style.color = "";
        showToast("Activity updated successfully!");
    } else {
        const todayString = getTodayDateString();
        if (activityDate < todayString) {
            const isConfirmed = confirm("⚠️ This date is in the past! Do you want to add this to your Overdue list?");
            if (!isConfirmed) return; 
        }
        myActivities.push({
            name: activityName, date: activityDate, time: activityTime,
            priority: activityPriority, description: activityDescription,
            repeat: activityRepeat,
            isCompleted: false,
            notified: false
        });
        showToast("Activity added successfully!");
    }
    localStorage.setItem("savedActivities", JSON.stringify(myActivities));
    redrawAll(); 
    activityForm.reset();
    if (activityDateInput) {
        activityDateInput.value = getTodayDateString();
    }
});

const clearCompletedBtn = document.getElementById("clear-completed-btn");
if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", function() {
        if (!confirm("Clear all completed activities?")) return;
        myActivities = myActivities.filter(act => !act.isCompleted);
        localStorage.setItem("savedActivities", JSON.stringify(myActivities));
        redrawAll();
        showToast("Completed activities cleared!");
    });
}

const savedData = localStorage.getItem("savedActivities");
if (savedData) {
    myActivities = JSON.parse(savedData);
    redrawAll();
}