// services/parser.js
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const db = require('./db');

let browserInstance = null;

async function getBrowser() {
    if (browserInstance) return browserInstance;

    console.log('Launching new browser instance...');
    try {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ]
        });

        browserInstance.on('disconnected', () => {
            console.log('Browser disconnected. Resetting instance.');
            browserInstance = null;
        });

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

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Чекаємо трохи довше, щоб переконатися, що JS відпрацював
        await new Promise(r => setTimeout(r, 6000));

        const html = await page.content();
        return html;

    } catch (error) {
        console.error(`Error processing ${url}:`, error.message);
        if (error.message.includes('Session closed')) browserInstance = null;
        return null;
    } finally {
        if (page) await page.close();
    }
}

function parseProjectDetails(mainHtml, url) {
    const errorResult = {
        score: 'N/A', parsedFields: ['', '', '', '', '', ''], scanDate: 'Failed',
        success: false, scoreValue: 0, minorIssues: ''
    };

    if (!mainHtml) return errorResult;

    try {
        const $ = cheerio.load(mainHtml);
        
        // 1. Отримуємо Score (Оцінку)
        let scoreElement = $('.c8e6500e7682');
        if (scoreElement.length === 0) {
            // Резервний пошук, якщо клас змінився
            scoreElement = $('div, span, h1').filter((i, el) => /^\d+(\.\d+)?%$/.test($(el).text().trim())).eq(0);
        }
        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';

        // 2. Розумна функція пошуку Issues
        const getCountById = (id) => {
            // СПРОБА 1: Шукаємо елемент, який прямо посилається на ID (aria-describedby="issue-count-critical")
            // Це працює для посилань <a> (коли помилок > 0)
            let el = $(`[aria-describedby="${id}"]`);
            let method = 'aria-link';

            // СПРОБА 2: Якщо атрибута немає (зазвичай це <span> з 0), шукаємо через батьківський <li>
            if (el.length === 0) {
                // Знаходимо сам лейбл (#issue-count-critical), йдемо до батька <li>, шукаємо цифру (.f5b9d169f9da)
                el = $(`#${id}`).closest('li').find('.f5b9d169f9da');
                method = 'parent-li';
            }

            if (el.length) {
                const rawText = el.text().trim();
                console.log(`[DEBUG] ${id}: found "${rawText}" via ${method}`); // Лог для перевірки

                if (['-', '–', '—', 'N/A', ''].includes(rawText)) return '0';
                return rawText.replace(/[^\d]/g, '') || '0';
            }
            
            console.log(`[DEBUG] ${id}: NOT FOUND`);
            return '0';
        };

        const critical = getCountById('issue-count-critical');
        const serious = getCountById('issue-count-serious');
        const moderate = getCountById('issue-count-moderate');
        const minor = getCountById('issue-count-minor');
        const total = getCountById('issue-count-total');

        return {
            score: scoreText || 'N/A',
            scanDate: scanDate,
            success: !!scoreText,
            scoreValue: parseFloat(scoreText?.replace('%', '')) || 0,
            minorIssues: minor, 
            // Порядок: [пусто, Total, Critical, Serious, Moderate, пусто]
            parsedFields: ['', total, critical, serious, moderate, '']
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
        const lastScan = db.prepare('SELECT scan_date FROM project_scores WHERE project_id = ? ORDER BY checked_at DESC LIMIT 1').get(project.id);
        
        if (!lastScan || lastScan.scan_date !== data.scanDate) {
            console.log(`New data found for project ${project.id}. Saving.`);
            db.prepare('INSERT INTO project_scores (project_id, score, scan_date) VALUES (?, ?, ?)')
              .run(project.id, data.scoreValue, data.scanDate);
        }
    }
    return data;
}

module.exports = { updateProjectScore };