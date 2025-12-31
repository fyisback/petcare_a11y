const Database = require('better-sqlite3');
const path = require('path');

// Шлях до бази даних
const dbPath = path.join(__dirname, 'data', 'database.sqlite');

try {
    const db = new Database(dbPath);
    console.log('Opening database at:', dbPath);

    // Спроба додати колонку
    try {
        db.prepare("ALTER TABLE project_scores ADD COLUMN issues_list_url TEXT").run();
        console.log("✅ Column 'issues_list_url' added successfully!");
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log("ℹ️ Column 'issues_list_url' already exists.");
        } else {
            console.error("❌ Error adding column:", err.message);
        }
    }

    db.close();
} catch (e) {
    console.error("Could not find database file. Please check the path.", e);
}