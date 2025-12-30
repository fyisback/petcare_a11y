// routes/project.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');

// Маршрут: /project/:id/score-history
router.get('/:id/score-history', (req, res) => {
    const projectId = req.params.id;

    try {
        // 1. Знаходимо інформацію про сам проект
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

        if (!project) {
            return res.status(404).render('404', { 
                pageTitle: 'Project Not Found',
                error: 'The requested project does not exist.'
            });
        }

        // 2. Дістаємо історію сканувань (найновіші зверху)
        // Вибираємо всі колонки, щоб мати доступ до critical_issues і т.д.
        const history = db.prepare(`
            SELECT * FROM project_scores 
            WHERE project_id = ? 
            ORDER BY checked_at DESC
        `).all(projectId);

        // 3. Віддаємо дані в шаблон
        res.render('score-history', {
            pageTitle: `History: ${project.custom_title || project.project_url}`,
            project,
            history
        });

    } catch (err) {
        console.error("Error loading history:", err);
        // Якщо немає окремої сторінки error.ejs, можна просто віддати текст або 404
        res.status(500).send("Server Error loading history");
    }
});

module.exports = router;