// services/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.RENDER_DISK_MOUNT_PATH || path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'database.sqlite');

if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
        console.error("Could not create data directory:", err);
    }
}

let db;
try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    console.log('Connected to SQLite.');
} catch (err) {
    console.error("Fatal Error connecting to DB:", err);
    process.exit(1);
}

function initializeDatabase() {
    db.exec(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, project_url TEXT NOT NULL UNIQUE, report_url TEXT, category TEXT NOT NULL, custom_title TEXT, status TEXT DEFAULT 'New scan available', meeting_notes TEXT, contact_person TEXT, ticketing_portal_url TEXT);`);
    db.exec(`CREATE TABLE IF NOT EXISTS on_hold_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, project_url TEXT NOT NULL UNIQUE, report_url TEXT, category TEXT NOT NULL, custom_title TEXT);`);
    
    // Створюємо таблицю (стара версія)
    db.exec(`CREATE TABLE IF NOT EXISTS project_scores (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, score INTEGER NOT NULL, scan_date TEXT NOT NULL, issues_html TEXT, checked_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS project_action_items (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, task TEXT NOT NULL, description TEXT, owner TEXT, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'To Do', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);`);
    db.exec(`CREATE TABLE IF NOT EXISTS action_items (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, owner TEXT, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'To Do', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    db.exec(`CREATE TABLE IF NOT EXISTS weekly_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);

    // 🔥 МІГРАЦІЯ: Додаємо колонки для помилок, якщо їх немає
    try {
        const columns = ['total_issues', 'critical_issues', 'serious_issues', 'moderate_issues', 'minor_issues'];
        columns.forEach(col => {
            try {
                db.exec(`ALTER TABLE project_scores ADD COLUMN ${col} TEXT DEFAULT '0'`);
                console.log(`Column added: ${col}`);
            } catch (e) {
                // Ігноруємо помилку, якщо колонка вже є
            }
        });
    } catch (err) {
        console.error("Migration error:", err);
    }
}

initializeDatabase();
module.exports = db;