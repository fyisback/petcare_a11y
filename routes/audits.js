const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Функція для вирахування A11y Score
function calculateScore(issues) {
    if (!issues || issues.length === 0) return 100;
    
    const severities = issues.map(i => i.severity);
    if (severities.includes('Critical')) return 0;
    if (severities.includes('High')) return 40;
    if (severities.includes('Medium')) return 60;
    if (severities.includes('Low')) return 80;
    
    return 100;
}

// GET: Головна сторінка Audits
router.get('/', (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        
        // Отримуємо всі сторінки
        const pages = db.prepare('SELECT * FROM audit_pages ORDER BY created_at DESC').all();
        
        let auditData = [];

        for (const page of pages) {
            // Шукаємо ішшюси. Якщо є пошук, шукаємо входження (LIKE) у title
            let issues;
            if (searchQuery) {
                issues = db.prepare(`
                    SELECT * FROM audit_issues 
                    WHERE page_id = ? AND title LIKE ? 
                    ORDER BY severity DESC
                `).all(page.id, `%${searchQuery}%`);
            } else {
                issues = db.prepare(`
                    SELECT * FROM audit_issues 
                    WHERE page_id = ? 
                    ORDER BY 
                        CASE severity 
                            WHEN 'Critical' THEN 1
                            WHEN 'High' THEN 2
                            WHEN 'Medium' THEN 3
                            WHEN 'Low' THEN 4
                            ELSE 5
                        END
                `).all(page.id);
            }

            // Якщо є активний пошук і на цій сторінці немає збігів, пропускаємо сторінку
            if (searchQuery && issues.length === 0) continue;

            // Вираховуємо скор на основі ВСІХ ішшюсів цієї сторінки (щоб скор не змінювався під час пошуку)
            const allPageIssues = db.prepare('SELECT severity FROM audit_issues WHERE page_id = ?').all(page.id);
            const pageScore = calculateScore(allPageIssues);

            auditData.push({
                ...page,
                score: pageScore,
                issues: issues
            });
        }

        res.render('audits', {
            pageTitle: 'Manual Audits',
            auditData: auditData,
            searchQuery: searchQuery
        });
    } catch (err) {
        console.error("Error loading audits:", err);
        res.status(500).send("Error loading audits data.");
    }
});

// POST: Додати нову сторінку
router.post('/pages/add', (req, res) => {
    try {
        const { name } = req.body;
        db.prepare('INSERT INTO audit_pages (name) VALUES (?)').run(name);
        res.redirect('/audits');
    } catch (err) {
        console.error("Error adding page:", err);
        res.redirect('/audits');
    }
});

// POST: Додати нове ішшю
router.post('/pages/:pageId/issues/add', (req, res) => {
    try {
        const { title, description, severity } = req.body;
        const pageId = req.params.pageId;
        db.prepare(`
            INSERT INTO audit_issues (page_id, title, description, severity) 
            VALUES (?, ?, ?, ?)
        `).run(pageId, title, description, severity);
        res.redirect('/audits');
    } catch (err) {
        console.error("Error adding issue:", err);
        res.redirect('/audits');
    }
});

// POST: Видалити ішшю
router.post('/issues/:issueId/delete', (req, res) => {
    try {
        db.prepare('DELETE FROM audit_issues WHERE id = ?').run(req.params.issueId);
        res.redirect('/audits');
    } catch (err) {
        console.error("Error deleting issue:", err);
        res.redirect('/audits');
    }
});

// POST: Видалити сторінку (каскадне видалення ішшюсів)
router.post('/pages/:pageId/delete', (req, res) => {
    try {
        db.prepare('DELETE FROM audit_pages WHERE id = ?').run(req.params.pageId);
        res.redirect('/audits');
    } catch (err) {
        console.error("Error deleting page:", err);
        res.redirect('/audits');
    }
});

module.exports = router;
