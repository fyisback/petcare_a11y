const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');

function getProjectsWithScores() {
    const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived' ORDER BY category, id").all();
    
    return projects.map(project => {
        // Отримуємо останній скан, включаючи час нашого парсингу (checked_at)
        const lastScore = db.prepare(`
            SELECT score, scan_date, checked_at, total_issues, critical_issues, serious_issues, moderate_issues, minor_issues
            FROM project_scores 
            WHERE project_id = ? 
            ORDER BY checked_at DESC LIMIT 1
        `).get(project.id);

        const reportButton = project.report_url && project.report_url !== 'https://example.com'
            ? `<a href="${project.report_url}" target="_blank"><button class="btn btn-sm btn-outline-primary" style="padding: 2px 8px; font-size: 0.8rem;">Report</button></a>`
            : `<button disabled class="btn btn-sm btn-outline-secondary" style="opacity: 0.5; cursor: not-allowed; padding: 2px 8px;">Report</button>`;

        // --- ЛОГІКА ДАТИ ---
        let parsedDateDisplay = 'Never';
        let rawDate = null;

        if (lastScore && lastScore.checked_at) {
            // SQLite іноді віддає дату без 'Z', додаємо її для коректного UTC
            const timeString = lastScore.checked_at.endsWith('Z') ? lastScore.checked_at : lastScore.checked_at + 'Z';
            const dateObj = new Date(timeString);
            
            rawDate = dateObj;
            
            // Форматуємо в Київський час: "30.12, 14:05"
            parsedDateDisplay = dateObj.toLocaleString('uk-UA', { 
                timeZone: 'Europe/Kyiv',
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
        }

        return {
            ...project,
            score: lastScore ? lastScore.score + '%' : 'N/A',
            scoreValue: lastScore ? lastScore.score : 0,
            
            // Нові поля дати
            lastParsed: parsedDateDisplay,
            rawDate: rawDate,

            // Поля помилок
            total: lastScore ? (lastScore.total_issues || '0') : 'N/A',
            critical: lastScore ? (lastScore.critical_issues || '0') : 'N/A',
            serious: lastScore ? (lastScore.serious_issues || '0') : 'N/A',
            moderate: lastScore ? (lastScore.moderate_issues || '0') : 'N/A',
            minor: lastScore ? (lastScore.minor_issues || '0') : 'N/A',

            success: !!lastScore,
            reportButton
        };
    });
}

router.get('/', (req, res) => {
    try {
        const activeProjectsData = getProjectsWithScores();
        const onHoldProjects = db.prepare('SELECT * FROM on_hold_projects ORDER BY category, id').all();

        // 1. Середнє по категоріях
        const categories = [...new Set(activeProjectsData.map(p => p.category))];
        const averageScores = categories.map(cat => {
            const projs = activeProjectsData.filter(p => p.category === cat && typeof p.scoreValue === 'number' && p.scoreValue > 0);
            const avg = projs.length ? (projs.reduce((sum, p) => sum + p.scoreValue, 0) / projs.length).toFixed(1) : 'N/A';
            return { category: cat, average: avg };
        });

        // 2. Загальне середнє (Grand Total)
        const allValidProjects = activeProjectsData.filter(p => typeof p.scoreValue === 'number' && p.scoreValue > 0);
        const grandTotalAverage = allValidProjects.length 
            ? (allValidProjects.reduce((sum, p) => sum + p.scoreValue, 0) / allValidProjects.length).toFixed(1) 
            : 'N/A';

        // 3. Знаходимо найсвіжішу дату оновлення системи
        let lastSystemUpdate = 'Not yet scanned';
        const dates = activeProjectsData.map(p => p.rawDate).filter(d => d);
        if (dates.length > 0) {
            // Беремо максимальну дату серед усіх проектів
            const maxDate = new Date(Math.max.apply(null, dates));
            lastSystemUpdate = maxDate.toLocaleString('en-US', { 
                timeZone: 'Europe/Kyiv',
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        }

        res.render('dashboard', {
            pageTitle: 'Dashboard',
            activeProjectsData,
            averageScores,
            grandTotalAverage,
            onHoldProjects,
            lastSystemUpdate, // Передаємо у шаблон
            error: req.query.error
        });
    } catch (err) {
        console.error("Error loading dashboard:", err);
        res.render('error', { error: err, pageTitle: 'Error Loading Dashboard' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        console.log("Starting manual refresh...");
        const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived'").all();
        for (const project of projects) await parser.updateProjectScore(project);
        res.redirect('/');
    } catch (err) {
        console.error("Error during refresh:", err);
        res.redirect('/?error=RefreshFailed');
    }
});

module.exports = router;