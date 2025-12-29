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

        // Встановлюємо User-Agent, щоб сайт не думав, що ми бот
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);
        
        // Зменшуємо таймаут до 20 секунд
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // Даємо ще 5 секунд на підвантаження JS
        await new Promise(r => setTimeout(r, 5000));

        // Спроба знайти хоч щось схоже на оцінку
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
        
        // --- ДІАГНОСТИКА ---
        console.log(`[DEBUG] Parsing URL: ${url}`);
        const pageTitle = $('title').text().trim();
        console.log(`[DEBUG] Page Title: "${pageTitle}"`);
        
        // 1. Перевіряємо старий клас
        let scoreElement = $('.c8e6500e7682');
        let method = 'Old Class';

        // 2. Якщо не знайшли, шукаємо ВСІ елементи, які містять знак %
        if (scoreElement.length === 0) {
            console.log(`[DEBUG] Old class .c8e6500e7682 NOT found. Searching for text containing "%"...`);
            
            // Шукаємо будь-який div, span або h1/h2, що містить %
            const possibleScores = $('div, span, h1, h2, p').filter((i, el) => {
                const text = $(el).text().trim();
                // Шукаємо текст, схожий на "85%" або "92.5%"
                return /^\d+(\.\d+)?%$/.test(text);
            });

            if (possibleScores.length > 0) {
                console.log(`[DEBUG] Found ${possibleScores.length} potential score elements by text content.`);
                // Беремо перший знайдений (або найглибший в DOM)
                scoreElement = possibleScores.eq(0);
                method = 'Text Search (%)';
                
                // Виводимо класи знайденого елемента, щоб ти міг оновити код
                console.log(`[DEBUG] FOUND ALTERNATIVE! Element classes: "${scoreElement.attr('class')}"`);
                console.log(`[DEBUG] Element tag: <${scoreElement.prop('tagName').toLowerCase()}>`);
            }
        }

        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';
        
        if (!scoreText) {
            console.log(`[FAIL] Score not found.`);
            // Виводимо шматок HTML (перші 2000 символів body), щоб ти подивився, що там взагалі є
            const bodySnippet = $('body').html()?.substring(0, 1500) || 'Body is empty';
            console.log(`[DEBUG HTML SNIPPET]: \n${bodySnippet}\n...`);
            return errorResult;
        }

        console.log(`[SUCCESS] Found score: "${scoreText}" using method: ${method}`);

        // Спроба знайти Issues (Critical, Serious і т.д.)
        // Якщо старий клас не працює, спробуємо знайти таблицю або список
        let issueElements = $('.f5b9d169f9da');
        if (issueElements.length === 0) {
             // Тут можна додати логіку пошуку issues, якщо вони теж відпали
             console.log(`[DEBUG] Issues list (.f5b9d169f9da) not found.`);
        }
        
        issueElements = issueElements.slice(0, 5);
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