const express = require('express');
const router = express.Router();
const db = require('../services/db');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 1. Налаштування Cloudinary з використанням твоїх ключів з .env
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

// 2. Налаштування Multer для збереження файлів у Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'a11y-audits', // Картинки будуть зберігатися у цій папці в Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    },
});
const upload = multer({ storage: storage });

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
        const pages = db.prepare('SELECT * FROM audit_pages ORDER BY created_at DESC').all();
        let auditData = [];

        for (const page of pages) {
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

            if (searchQuery && issues.length === 0) continue;

            const allPageIssues = db.prepare('SELECT severity FROM audit_issues WHERE page_id = ?').all(page.id);
            const pageScore = calculateScore(allPageIssues);

            auditData.push({ ...page, score: pageScore, issues: issues });
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

// POST: Додати нове ішшю з картинкою
// Використовуємо upload.single('image_file'), де 'image_file' - це name поля у HTML формі
router.post('/pages/:pageId/issues/add', upload.single('image_file'), (req, res) => {
    try {
        const { title, description, severity } = req.body;
        const pageId = req.params.pageId;
        
        // Якщо Cloudinary успішно зберіг файл, він повертає готове посилання у req.file.path
        const imageUrl = req.file ? req.file.path : null;

        db.prepare(`
            INSERT INTO audit_issues (page_id, title, description, severity, image_url) 
            VALUES (?, ?, ?, ?, ?)
        `).run(pageId, title, description, severity, imageUrl);
        
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

// POST: Видалити сторінку
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