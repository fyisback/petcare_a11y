const express = require('express');
const path = require('path');

// 1. Ініціалізація бази даних (автоматично створює таблиці при старті)
const db = require('./services/db'); 

// 2. Запуск планувальника (Cron Job)
// Це запускає таймер, який щодня о 12:00 за Києвом оновлює дані
require('./services/scheduler'); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware (Налаштування сервера) ---
// Дозволяє серверу розуміти дані, відправлені через форми (POST запити)
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

// Вказуємо папку для статичних файлів (CSS, картинки, клієнтські скрипти)
app.use(express.static(path.join(__dirname, 'public'))); 

// --- View Engine (Шаблонізатор) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Маршрути (Routes) ---

// 1. Головна сторінка (Дашборд + Експорт у CSV)
app.use('/', require('./routes/dashboard'));

// 2. Адмін-панель (Додавання/Редагування/Видалення проектів)
app.use('/admin', require('./routes/admin'));

// 3. Тижневі звіти (якщо використовуються)
app.use('/weekly', require('./routes/weekly'));

// 4. 🔥 Детальна сторінка проекту (Історія + Задачі Action Items)
app.use('/project', require('./routes/project'));
app.use('/audits', require('./routes/audits'));

// --- Обробка помилки 404 (Сторінка не знайдена) ---
app.use((req, res) => {
    // Рендеримо красиву сторінку помилки, якщо вона є
    res.status(404).render('404');
});

// --- Запуск сервера ---
app.listen(PORT, () => {
    console.log(`-----------------------------------------------`);
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`👉 Local:   http://localhost:${PORT}`);
    console.log(`⏰ Scheduler is active (12:00 Kyiv Time)`);
    console.log(`-----------------------------------------------`);
});
