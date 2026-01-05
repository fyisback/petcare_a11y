const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const db = require('./db');
const { scrapeProjectDetails } = require('./detailsScraper');

let browserInstance = null;

async function getBrowser() {
    if (browserInstance) return browserInstance;
    try {
        console.log('[Parser] Launching new browser instance...');
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
        });
        browserInstance.on('disconnected', () => { browserInstance = null; });
        return browserInstance;
    } catch (error) {
        console.error('[Parser] Failed to launch browser:', error);
        throw error;
    }
}

async function fetchData(url) {
    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`[Parser] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 6000));
        
        return await page.content();
    } catch (error) {
        console.error(`[Parser] Error processing ${url}:`, error.message);
        if (error.message.includes('Session closed')) browserInstance = null;
        return null;
    } finally {
        if (page) await page.close();
    }
}

function normalizeCount(rawText) {
    if (!rawText) return '0';
    let text = rawText.trim().toLowerCase();
    if (['-', '–', '—', 'n/a', '', 'nan'].includes(text)) return '0';

    let multiplier = 1;
    if (text.includes('k') || text.includes('тис')) multiplier = 1000;
    else if (text.includes('m') || text.includes('млн')) multiplier = 1000000;

    text = text.replace(',', '.').replace(/[^\d.]/g, '');
    const number = parseFloat(text);
    if (isNaN(number)) return '0';
    return Math.floor(number * multiplier).toString();
}

function parseProjectDetails(mainHtml, url) {
    const errorResult = { success: false, score: 'N/A', scoreValue: 0, scanDate: 'Failed', details: { total: '0', critical: '0', serious: '0', moderate: '0', minor: '0' } };
    if (!mainHtml) return errorResult;

    try {
        const $ = cheerio.load(mainHtml);
        
        let scoreElement = $('.c8e6500e7682');
        if (scoreElement.length === 0) {
            scoreElement = $('div, span, h1').filter((i, el) => /^\d+(\.\d+)?%$/.test($(el).text().trim())).eq(0);
        }
        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';

        const getCountById = (id) => {
            let el = $(`[aria-describedby="${id}"]`);
            if (el.length === 0) el = $(`#${id}`).closest('li').find('.f5b9d169f9da');
            if (el.length) return normalizeCount(el.text().trim());
            return '0';
        };

        const total = getCountById('issue-count-total');
        const critical = getCountById('issue-count-critical');
        const serious = getCountById('issue-count-serious');
        const moderate = getCountById('issue-count-moderate');
        const minor = getCountById('issue-count-minor');

        console.log(`[Parser] Main Data -> Score: ${scoreText}, Total: ${total}, Date: ${scanDate}`);

        return {
            success: !!scoreText,
            score: scoreText || 'N/A',
            scoreValue: parseFloat(scoreText?.replace('%', '')) || 0,
            scanDate: scanDate,
            details: { total, critical, serious, moderate, minor }
        };
    } catch (e) {
        console.error(`[Parser] Error:`, e);
        return errorResult;
    }
}

async function updateProjectScore(project) {
    // 1. Спочатку парсимо "легку" сторінку з основною інфою
    const html = await fetchData(project.project_url);
    const data = parseProjectDetails(html, project.project_url);

    if (data.success) {
        // 2. 🔥 ПЕРЕВІРКА: Чи змінились дані?
        // Отримуємо останній запис для цього проекту
        const lastRecord = db.prepare(`
            SELECT score, scan_date, total_issues 
            FROM project_scores 
            WHERE project_id = ? 
            ORDER BY id DESC LIMIT 1
        `).get(project.id);

        // Логіка порівняння: 
        // Якщо дата, скор І загальна кількість помилок збігаються з останнім записом - нічого не робимо.
        const isUpToDate = lastRecord && 
                           lastRecord.scan_date === data.scanDate &&
                           lastRecord.score === data.scoreValue &&
                           String(lastRecord.total_issues) === String(data.details.total);

        if (isUpToDate) {
            console.log(`[Parser] 🟢 Project ID ${project.id} is up to date (Scan: ${data.scanDate}). Skipping details scan.`);
            
            // Оновлюємо поле checked_at, щоб знати, що ми перевіряли, навіть якщо нових даних немає
            db.prepare(`
                UPDATE project_scores 
                SET checked_at = CURRENT_TIMESTAMP 
                WHERE id = (SELECT id FROM project_scores WHERE project_id = ? ORDER BY id DESC LIMIT 1)
            `).run(project.id);

            return data; // Виходимо, не запускаючи scrapeProjectDetails
        }

        console.log(`[Parser] 🔄 New scan detected! (Old: ${lastRecord?.scan_date} -> New: ${data.scanDate}). Updating...`);

        // 3. Якщо дані нові — запускаємо важкий скрапер і пишемо в БД
        let issuesUrl = null;

        try {
            console.log(`[Parser] Fetching detailed issues for ${project.id}...`);
            const result = await scrapeProjectDetails(project.project_url);
            
            const issueDetails = result.issues;
            issuesUrl = result.url; 

            const updateDetailsTx = db.transaction((issues) => {
                db.prepare('DELETE FROM issue_details WHERE project_id = ?').run(project.id);
                const insert = db.prepare(`
                    INSERT INTO issue_details (project_id, description, severity, pages_count, issues_count, issue_link)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                for (const issue of issues) {
                    insert.run(project.id, issue.description, issue.severity, issue.pages_count, issue.issues_count, issue.issue_link);
                }
            });

            if (issueDetails.length > 0) {
                updateDetailsTx(issueDetails);
                console.log(`[DB] Saved ${issueDetails.length} detailed issues.`);
            }
        } catch (detailErr) {
            console.error(`[Parser] Details Error:`, detailErr.message);
        }

        // 4. Зберігаємо нову історію в project_scores
        try {
            db.prepare(`
                INSERT INTO project_scores 
                (project_id, score, scan_date, total_issues, critical_issues, serious_issues, moderate_issues, minor_issues, issues_list_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                project.id, 
                data.scoreValue, 
                data.scanDate, 
                data.details.total, 
                data.details.critical, 
                data.details.serious, 
                data.details.moderate, 
                data.details.minor,
                issuesUrl 
            );
            console.log(`[DB] New history record inserted.`);
        } catch (dbErr) {
            console.error(`[DB ERROR]`, dbErr);
        }
    }
    return data;
}

module.exports = { updateProjectScore };