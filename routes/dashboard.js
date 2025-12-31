const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');

// Функція для отримання проектів
function getProjectsWithScores() {
    const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived' ORDER BY category, id").all();
    
    return projects.map(project => {
        const history = db.prepare(`
            SELECT score, scan_date, checked_at, total_issues, critical_issues, serious_issues, moderate_issues, minor_issues
            FROM project_scores 
            WHERE project_id = ? 
            ORDER BY checked_at DESC LIMIT 2
        `).all(project.id);

        const lastScore = history[0];
        const previousScore = history[1];

        const reportButton = project.report_url && project.report_url !== 'https://example.com'
            ? `<a href="${project.report_url}" target="_blank"><button class="btn-history" style="border: 1px solid #007bff; color: #007bff;">Report</button></a>`
            : `<button disabled class="btn-history" style="opacity: 0.5; cursor: not-allowed;">Report</button>`;

        let parsedDateDisplay = 'Never';
        let rawDate = null;

        if (lastScore && lastScore.checked_at) {
            const timeString = lastScore.checked_at.endsWith('Z') ? lastScore.checked_at : lastScore.checked_at + 'Z';
            const dateObj = new Date(timeString);
            rawDate = dateObj;
            parsedDateDisplay = dateObj.toLocaleString('uk-UA', { 
                timeZone: 'Europe/Kyiv',
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
        }

        let scoreTrend = 0;
        let critTrend = 0;

        if (lastScore && previousScore) {
            scoreTrend = lastScore.score - previousScore.score;
            const currCrit = parseInt(lastScore.critical_issues || 0);
            const prevCrit = parseInt(previousScore.critical_issues || 0);
            critTrend = currCrit - prevCrit;
        }

        return {
            ...project,
            score: lastScore ? lastScore.score + '%' : 'N/A',
            scoreValue: lastScore ? lastScore.score : 0,
            scoreTrend, critTrend, hasHistory: !!previousScore,
            scanDate: lastScore ? lastScore.scan_date : 'No scans yet',
            lastParsed: parsedDateDisplay, rawDate: rawDate,
            total: lastScore ? (lastScore.total_issues || '0') : 'N/A',
            critical: lastScore ? (lastScore.critical_issues || '0') : 'N/A',
            serious: lastScore ? (lastScore.serious_issues || '0') : 'N/A',
            moderate: lastScore ? (lastScore.moderate_issues || '0') : 'N/A',
            minor: lastScore ? (lastScore.minor_issues || '0') : 'N/A',
            success: !!lastScore, reportButton
        };
    });
}

// Головна сторінка
router.get('/', (req, res) => {
    try {
        const activeProjectsData = getProjectsWithScores();
        req.app.locals.activeProjectsData = activeProjectsData; // Кешуємо для роута details

        const onHoldProjects = db.prepare('SELECT * FROM on_hold_projects ORDER BY category, id').all();
        const categories = [...new Set(activeProjectsData.map(p => p.category))];
        const averageScores = categories.map(cat => {
            const projs = activeProjectsData.filter(p => p.category === cat && typeof p.scoreValue === 'number' && p.scoreValue > 0);
            const avg = projs.length ? (projs.reduce((sum, p) => sum + p.scoreValue, 0) / projs.length).toFixed(1) : 'N/A';
            return { category: cat, average: avg };
        });

        const allValidProjects = activeProjectsData.filter(p => typeof p.scoreValue === 'number' && p.scoreValue > 0);
        const grandTotalAverage = allValidProjects.length 
            ? (allValidProjects.reduce((sum, p) => sum + p.scoreValue, 0) / allValidProjects.length).toFixed(1) 
            : 'N/A';

        let lastSystemUpdate = 'Not yet scanned';
        const dates = activeProjectsData.map(p => p.rawDate).filter(d => d);
        if (dates.length > 0) {
            const maxDate = new Date(Math.max.apply(null, dates));
            lastSystemUpdate = maxDate.toLocaleString('en-US', { timeZone: 'Europe/Kyiv', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        res.render('dashboard', {
            pageTitle: 'Dashboard', activeProjectsData, averageScores, grandTotalAverage, onHoldProjects, lastSystemUpdate, error: req.query.error
        });
    } catch (err) {
        console.error("Error loading dashboard:", err);
        res.render('error', { error: err, pageTitle: 'Error' });
    }
});

router.get('/export', (req, res) => {
    try {
        const data = getProjectsWithScores();
        let csvContent = "Category,Project Name,URL,Score,Total Issues,Critical,Serious,Moderate,Minor,Last Scan Date,System Checked At\n";
        data.forEach(p => {
            const name = `"${(p.custom_title || '').replace(/"/g, '""')}"`;
            const row = [p.category, name, p.project_url, p.scoreValue, p.total, p.critical, p.serious, p.moderate, p.minor, `"${p.scanDate}"`, `"${p.lastParsed}"`].join(",");
            csvContent += row + "\n";
        });
        res.header('Content-Type', 'text/csv');
        res.attachment(`report_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);
    } catch (err) { res.redirect('/?error=ExportFailed'); }
});

router.post('/refresh', async (req, res) => {
    try {
        console.log("Starting manual refresh...");
        const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived'").all();
        for (const project of projects) await parser.updateProjectScore(project);
        res.redirect('/');
    } catch (err) { res.redirect('/?error=RefreshFailed'); }
});

// 🔥 ОНОВЛЕНИЙ РОУТ /details (Тільки БД, без Puppeteer)
router.get('/project/:id/details', (req, res) => {
    try {
        const projectId = req.params.id;
        const issues = db.prepare(`
            SELECT description, severity, pages_count, issues_count, issue_link 
            FROM issue_details WHERE project_id = ? ORDER BY issues_count DESC
        `).all(projectId);
        
        res.json({ success: true, issues });
    } catch (error) {
        console.error('Details error:', error);
        res.status(500).json({ success: false, error: 'DB Error' });
    }
});

module.exports = router;