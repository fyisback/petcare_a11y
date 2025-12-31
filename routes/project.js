const express = require('express');
const router = express.Router();
const db = require('../services/db');

// GET: Сторінка історії + Задачі
router.get('/:id/score-history', (req, res) => {
    const projectId = req.params.id;

    try {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
        if (!project) return res.status(404).render('404');

        // Історія сканувань
        const history = db.prepare(`
            SELECT * FROM project_scores 
            WHERE project_id = ? 
            ORDER BY checked_at DESC
        `).all(projectId);

        // 🔥 ЗАДАЧІ (Action Items)
        const tasks = db.prepare(`
            SELECT * FROM project_action_items 
            WHERE project_id = ? 
            ORDER BY status DESC, created_at DESC
        `).all(projectId);

        res.render('score-history', {
            pageTitle: `History: ${project.custom_title || project.project_url}`,
            project,
            history,
            tasks // Передаємо задачі в шаблон
        });

    } catch (err) {
        console.error("Error loading history:", err);
        res.status(500).send("Server Error");
    }
});

// POST: Додати нову задачу
router.post('/:id/add-task', (req, res) => {
    try {
        const { task, owner } = req.body;
        db.prepare(`
            INSERT INTO project_action_items (project_id, task, owner, priority, status)
            VALUES (?, ?, ?, 'Medium', 'To Do')
        `).run(req.params.id, task, owner || 'Team');
        
        res.redirect(`/project/${req.params.id}/score-history`);
    } catch (err) {
        console.error(err);
        res.redirect(`/project/${req.params.id}/score-history?error=TaskAddFailed`);
    }
});

// GET: Перемкнути статус (To Do <-> Done)
router.get('/:id/toggle-task/:taskId', (req, res) => {
    try {
        const task = db.prepare('SELECT status FROM project_action_items WHERE id = ?').get(req.params.taskId);
        const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
        
        db.prepare('UPDATE project_action_items SET status = ? WHERE id = ?').run(newStatus, req.params.taskId);
        res.redirect(`/project/${req.params.id}/score-history`);
    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

// GET: Видалити задачу
router.get('/:id/delete-task/:taskId', (req, res) => {
    try {
        db.prepare('DELETE FROM project_action_items WHERE id = ?').run(req.params.taskId);
        res.redirect(`/project/${req.params.id}/score-history`);
    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});

module.exports = router;