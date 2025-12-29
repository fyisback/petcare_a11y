// server.js
const express = require('express');
const path = require('path');
const db = require('./services/db'); // Ініціалізує БД при запуску

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Для CSS

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/admin', require('./routes/admin'));
app.use('/weekly', require('./routes/weekly'));

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404');
});

// Запуск
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});