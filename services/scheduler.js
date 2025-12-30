// services/scheduler.js
const cron = require('node-cron');
const db = require('./db');
const parser = require('./parser');

// Функція запуску сканування
async function runDailyScan() {
    console.log('⏰ [SCHEDULER] Starting daily scheduled scan (12:00 Kyiv Time)...');

    try {
        // Отримуємо всі активні проекти
        const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived'").all();

        if (projects.length === 0) {
            console.log('⚠️ [SCHEDULER] No active projects to scan.');
            return;
        }

        console.log(`📋 [SCHEDULER] Found ${projects.length} projects. Scanning sequentially...`);

        // Скануємо по черзі, щоб економити RAM
        for (const project of projects) {
            console.log(`👉 [SCHEDULER] Scanning: ${project.custom_title || project.project_url}`);
            try {
                await parser.updateProjectScore(project);
            } catch (err) {
                console.error(`❌ [SCHEDULER] Failed to scan project ${project.id}:`, err.message);
            }
            
            // Пауза 5 секунд між сайтами (для стабільності)
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('✅ [SCHEDULER] Daily scan completed successfully.');

    } catch (err) {
        console.error('🔥 [SCHEDULER] Critical error during daily scan:', err);
    }
}

// Налаштування CRON
// '0 12 * * *' означає: 0 хвилин, 12 годин, кожен день, кожен місяць, кожен день тижня
cron.schedule('0 12 * * *', () => {
    runDailyScan();
}, {
    scheduled: true,
    timezone: "Europe/Kyiv" // 🔥 Важливо: Автоматично враховує перехід на літній/зимовий час в Україні
});

console.log('✅ [SCHEDULER] Daily scan scheduled for 12:00 Kyiv time.');

module.exports = { runDailyScan };