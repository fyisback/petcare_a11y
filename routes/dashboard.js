// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const parser = require('../services/parser');

function getProjectsWithScores() {
    const projects = db.prepare("SELECT * FROM projects WHERE status != 'Archived' ORDER BY category, id").all();
    
    return projects.map(project => {
        // Читаємо ВСІ колонки, включаючи нові
        const lastScore = db.prepare(`
            SELECT score, scan_date, total_issues, critical_issues, serious_issues, moderate_issues, minor_issues
            FROM project_scores 
            WHERE project_id = ? 
            ORDER BY checked_at DESC LIMIT 1
        `).get(project.id);

        const reportButton = project.report_url && project.report_url !== 'https://example.com'
            ? `<a href="${project.report_url}" target="_blank"><button class="btn-primary" style="padding: 2px 8px; font-size: 0.8rem;">Report</button></a>`
            : `<button disabled style="opacity: 0.5; cursor: not-allowed; padding: 2px 8px;">Report</button>`;

        return {
            ...project,
            score: lastScore ? lastScore.score + '%' : 'N/A',
            scoreValue: lastScore ? lastScore.score : 0,
            scanDate: lastScore ? lastScore.scan_date : 'No scans yet',
            
            // Мапимо колонки БД (xxx_issues) на зручні поля для EJS
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

        const categories = [...new Set(activeProjectsData.map(p => p.category))];
        const averageScores = categories.map(cat => {
            const projs = activeProjectsData.filter(p => p.category === cat && typeof p.scoreValue === 'number' && p.scoreValue > 0);
            const avg = projs.length ? (projs.reduce((sum, p) => sum + p.scoreValue, 0) / projs.length).toFixed(1) : 'N/A';
            return { category: cat, average: avg };
        });

        res.render('dashboard', {
            pageTitle: 'Dashboard',
            activeProjectsData,
            averageScores,
            onHoldProjects,
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
        
        for (const project of projects) {
            await parser.updateProjectScore(project);
        }
        res.redirect('/');
    } catch (err) {
        console.error("Error during refresh:", err);
        res.redirect('/?error=RefreshFailed');
    }
});

module.exports = router;