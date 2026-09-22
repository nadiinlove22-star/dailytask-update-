function isTaskActiveForDate(task, dateStr) {
    if (task.createdDate && task.createdDate > dateStr) return false;
    if (task.deletedDates && task.deletedDates.includes(dateStr)) return false;

    if (!task.freq || task.freq === 'daily') return true;
    const targetDate = new Date(dateStr);
    const dayIndex = targetDate.getDay();

    if (task.freq === 'weekly') return parseInt(task.freqVal) === dayIndex;
    if (task.freq === 'custom_day') return (task.freqVal ? task.freqVal.toString().split(',').map(Number) : []).includes(dayIndex);
    if (task.freq === 'monthly') return targetDate.getDate() == parseInt(task.freqVal || 1);
    if (task.freq === 'specific_date') return task.freqVal === dateStr;
    return true;
}

function isTaskActiveForSelectedDay(task) {
    return isTaskActiveForDate(task, getSelectedDateString());
}

function saveNewTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const freq = document.getElementById('new-task-freq').value;
    const target = parseInt(document.getElementById('new-task-target').value) || 1;
    if (!title) return;
    let freqVal = '';
    if (freq === 'weekly' || freq === 'monthly' || freq === 'specific_date') {
        const el = document.getElementById('new-freq-val');
        freqVal = el ? el.value : '';
    } else if (freq === 'custom_day') {
        const checkboxes = document.querySelectorAll('#new-custom-days-container input:checked');
        freqVal = Array.from(checkboxes).map(cb => cb.value).join(',');
    }
    
    tasks.push({ 
        id: Date.now(), 
        title, 
        target, 
        freq, 
        freqVal, 
        createdDate: getSelectedDateString(),
        deletedDates: []
    });
    
    saveData();
    closeAddModal();
    renderTodoList();
}

function saveEditTask() {
    const id = parseInt(document.getElementById('edit-task-id').value);
    const title = document.getElementById('edit-task-title').value.trim();
    const freq = document.getElementById('edit-task-freq').value;
    const target = parseInt(document.getElementById('edit-task-target').value) || 1;
    if (!title) return;
    let freqVal = '';
    if (freq === 'weekly' || freq === 'monthly' || freq === 'specific_date') {
        const el = document.getElementById('edit-freq-val');
        freqVal = el ? el.value : '';
    } else if (freq === 'custom_day') {
        const checkboxes = document.querySelectorAll('#edit-custom-days-container input:checked');
        freqVal = Array.from(checkboxes).map(cb => cb.value).join(',');
    }
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], title, target, freq, freqVal };
        saveData();
        renderTodoList();
    }
    closeEditModal();
}

function deleteTask(taskId, taskTitle) {
    const dateStr = getSelectedDateString();
    if (confirm(`Hapus "${taskTitle}" khusus untuk tanggal ini? (Riwayat hari lain tidak terhapus)`)) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            if (!task.deletedDates) task.deletedDates = [];
            task.deletedDates.push(dateStr);
            saveData();
            renderTodoList();
        }
    }
}

function moveTaskUp(visibleIndex) {
    let visibleTasks = tasks.filter(t => isTaskActiveForSelectedDay(t));
    if (visibleIndex <= 0) return;
    const currentTask = visibleTasks[visibleIndex];
    const prevTask = visibleTasks[visibleIndex - 1];
    const currentIndex = tasks.findIndex(t => t.id === currentTask.id);
    const targetIndex = tasks.findIndex(t => t.id === prevTask.id);
    if (currentIndex !== -1 && targetIndex !== -1) {
        const temp = tasks[currentIndex];
        tasks[currentIndex] = tasks[targetIndex];
        tasks[targetIndex] = temp;
        saveData();
        renderTodoList();
    }
}

function moveTaskDown(visibleIndex) {
    let visibleTasks = tasks.filter(t => isTaskActiveForSelectedDay(t));
    if (visibleIndex >= visibleTasks.length - 1) return;
    const currentTask = visibleTasks[visibleIndex];
    const nextTask = visibleTasks[visibleIndex + 1];
    const currentIndex = tasks.findIndex(t => t.id === currentTask.id);
    const targetIndex = tasks.findIndex(t => t.id === nextTask.id);
    if (currentIndex !== -1 && targetIndex !== -1) {
        const temp = tasks[currentIndex];
        tasks[currentIndex] = tasks[targetIndex];
        tasks[targetIndex] = temp;
        saveData();
        renderTodoList();
    }
}
