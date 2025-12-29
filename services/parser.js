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

        // Блокуємо важкі ресурси для прискорення
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log(`Navigating to ${url}...`);
        // Чекаємо завантаження DOM, таймаут 60с
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 🔥 ГОЛОВНЕ: Чекаємо саме на ваш клас до 60 секунд
        console.log('Waiting for selector .c8e6500e7682 ...');
        try {
            await page.waitForSelector('.c8e6500e7682', { timeout: 60000 });
            console.log('Selector found!');
        } catch (e) {
            console.error(`Timeout waiting for selector .c8e6500e7682 on ${url}`);
            // Якщо не знайшли, все одно спробуємо взяти контент, раптом він там є в іншому вигляді
        }

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
        
        // Використовуємо ваш перевірений клас
        const scoreElement = $('.c8e6500e7682');
        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';
        
        if (!scoreText) {
            console.log(`[FAIL] Score element .c8e6500e7682 found but empty or missing text.`);
            return errorResult;
        }

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