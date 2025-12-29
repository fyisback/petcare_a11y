// services/parser.js
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const db = require('./db');

let browserInstance = null;

// Функція Singleton для браузера (запускається один раз)
async function getBrowser() {
    if (browserInstance) return browserInstance;

    console.log('Launching new browser instance...');
    try {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Критично для Docker/Render
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ]
        });

        browserInstance.on('disconnected', () => {
            console.log('Browser disconnected. Clearing instance.');
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

        // Блокуємо завантаження картинок та стилів для швидкості
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Таймаут 45 секунд, чекаємо завантаження DOM
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Пробуємо чекати селектор зі скором, але не падаємо, якщо його немає
        try {
            await page.waitForSelector('.c8e6500e7682', { timeout: 10000 });
        } catch (e) {
            console.log(`Selector wait timeout for ${url}, parsing anyway.`);
        }

        const html = await page.content();
        return html;

    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        if (error.message.includes('Session closed')) browserInstance = null;
        return null;
    } finally {
        if (page) await page.close(); // Закриваємо сторінку, але не браузер
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
        const scoreText = $('.c8e6500e7682').text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';
        
        // Якщо скору немає, повертаємо помилку
        if (!scoreText) return errorResult;

        const issueElements = $('.f5b9d169f9da').slice(0, 5);
        const values = issueElements.map((i, el) => $(el).text().trim()).get();

        return {
            score: scoreText,
            scanDate: scanDate,
            success: true,
            scoreValue: parseFloat(scoreText.replace('%', '')) || 0,
            minorIssues: values[3] || '',
            parsedFields: ['', values[4], values[0], values[1], values[2], '']
        };
    } catch (e) {
        console.error(`Parsing error for ${url}:`, e);
        return errorResult;
    }
}

// Головна функція оновлення одного проєкту
async function updateProjectScore(project) {
    console.log(`Scanning: ${project.project_url}`);
    const html = await fetchData(project.project_url);
    const data = parseProjectDetails(html, project.project_url);

    if (data.success) {
        // Перевіряємо, чи змінилася дата сканування перед записом у БД
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