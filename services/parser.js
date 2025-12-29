// services/parser.js
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const db = require('./db');

let browserInstance = null;

async function getBrowser() {
    if (browserInstance) return browserInstance;
    try {
        console.log('Launching new browser instance...');
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process']
        });
        browserInstance.on('disconnected', () => { browserInstance = null; });
        return browserInstance;
    } catch (error) {
        console.error('Failed to launch browser:', error);
        throw error;
    }
}

async function fetchData(url) {
    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Маскуємось під людину
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Чекаємо промальовки JS (6 сек)
        await new Promise(r => setTimeout(r, 6000));
        
        return await page.content();
    } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
        if (error.message.includes('Session closed')) browserInstance = null;
        return null;
    } finally {
        if (page) await page.close();
    }
}

// Перетворює "1.6K" -> "1600", "N/A" -> "0"
function normalizeCount(rawText) {
    if (!rawText) return '0';
    let text = rawText.trim().toUpperCase();
    
    if (['-', '–', '—', 'N/A', ''].includes(text)) return '0';

    let multiplier = 1;
    if (text.endsWith('K')) { multiplier = 1000; text = text.replace('K', ''); } 
    else if (text.endsWith('M')) { multiplier = 1000000; text = text.replace('M', ''); }

    text = text.replace(/[^\d.]/g, ''); // Залишаємо тільки цифри і крапку
    const number = parseFloat(text);
    
    if (isNaN(number)) return '0';
    return Math.floor(number * multiplier).toString();
}

function parseProjectDetails(mainHtml, url) {
    const errorResult = { success: false, score: 'N/A', scoreValue: 0, scanDate: 'Failed', details: { total: '0', critical: '0', serious: '0', moderate: '0', minor: '0' } };

    if (!mainHtml) return errorResult;

    try {
        const $ = cheerio.load(mainHtml);
        
        // --- 1. Score ---
        let scoreElement = $('.c8e6500e7682');
        if (scoreElement.length === 0) {
            scoreElement = $('div, span, h1').filter((i, el) => /^\d+(\.\d+)?%$/.test($(el).text().trim())).eq(0);
        }
        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';

        // --- 2. Issues (Hybrid Search) ---
        const getCountById = (id) => {
            // Спроба 1: шукаємо по aria-describedby (для лінків)
            let el = $(`[aria-describedby="${id}"]`);
            
            // Спроба 2: якщо не знайшли, шукаємо через батьківський li (для нулів)
            if (el.length === 0) {
                el = $(`#${id}`).closest('li').find('.f5b9d169f9da');
            }

            if (el.length) {
                return normalizeCount(el.text().trim());
            }
            return '0';
        };

        const total = getCountById('issue-count-total');
        const critical = getCountById('issue-count-critical');
        const serious = getCountById('issue-count-serious');
        const moderate = getCountById('issue-count-moderate');
        const minor = getCountById('issue-count-minor');

        console.log(`[PARSED] ${url} -> Score: ${scoreText}, Total: ${total}, Crit: ${critical}`);

        return {
            success: !!scoreText,
            score: scoreText || 'N/A',
            scoreValue: parseFloat(scoreText?.replace('%', '')) || 0,
            scanDate: scanDate,
            details: { total, critical, serious, moderate, minor }
        };

    } catch (e) {
        console.error(`Parsing error for ${url}:`, e);
        return errorResult;
    }
}

async function updateProjectScore(project) {
    const html = await fetchData(project.project_url);
    const data = parseProjectDetails(html, project.project_url);

    if (data.success) {
        console.log(`[DB] Saving project ${project.id} (Crit: ${data.details.critical}, Serious: ${data.details.serious})`);
        
        try {
            db.prepare(`
                INSERT INTO project_scores 
                (project_id, score, scan_date, total_issues, critical_issues, serious_issues, moderate_issues, minor_issues) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                project.id, 
                data.scoreValue, 
                data.scanDate, 
                data.details.total, 
                data.details.critical, 
                data.details.serious, 
                data.details.moderate, 
                data.details.minor
            );
        } catch (dbErr) {
            console.error(`[DB ERROR] Failed to insert score:`, dbErr);
        }
    }
    return data;
}

module.exports = { updateProjectScore };