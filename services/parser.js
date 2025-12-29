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
        
        // Чекаємо трохи довше для великих сторінок
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

// 🔥 НОВА ФУНКЦІЯ: Перетворює "1.6K" у 1600, "70" у 70
function normalizeCount(rawText) {
    if (!rawText) return '0';
    let text = rawText.trim().toUpperCase();

    // Якщо це прочерк або N/A
    if (['-', '–', '—', 'N/A', ''].includes(text)) return '0';

    // Множник для тисяч (K) або мільйонів (M)
    let multiplier = 1;
    if (text.endsWith('K')) {
        multiplier = 1000;
        text = text.replace('K', '');
    } else if (text.endsWith('M')) {
        multiplier = 1000000;
        text = text.replace('M', '');
    }

    // Видаляємо все, крім цифр і крапки (щоб розпізнати 1.6)
    text = text.replace(/[^\d.]/g, '');

    const number = parseFloat(text);
    if (isNaN(number)) return '0';

    // Повертаємо фінальне число (наприклад 1.6 * 1000 = 1600)
    return Math.floor(number * multiplier).toString();
}

function parseProjectDetails(mainHtml, url) {
    const errorResult = {
        score: 'N/A', parsedFields: ['', '', '', '', '', ''], scanDate: 'Failed',
        success: false, scoreValue: 0, minorIssues: ''
    };

    if (!mainHtml) return errorResult;

    try {
        const $ = cheerio.load(mainHtml);
        
        // 1. Отримуємо Score
        let scoreElement = $('.c8e6500e7682');
        if (scoreElement.length === 0) {
            scoreElement = $('div, span, h1').filter((i, el) => /^\d+(\.\d+)?%$/.test($(el).text().trim())).eq(0);
        }
        const scoreText = scoreElement.text().trim();
        const scanDate = $('#menu-trigger5').text().trim() || 'N/A';

        // 2. Отримуємо Issues
        const getCountById = (id) => {
            // Метод 1: aria-describedby
            let el = $(`[aria-describedby="${id}"]`);
            let method = 'aria-link';

            // Метод 2: parent-li
            if (el.length === 0) {
                el = $(`#${id}`).closest('li').find('.f5b9d169f9da');
                method = 'parent-li';
            }

            if (el.length) {
                const rawText = el.text().trim();
                console.log(`[DEBUG] ${id}: raw "${rawText}" via ${method}`);
                
                // Використовуємо нову логіку нормалізації
                return normalizeCount(rawText);
            }
            
            return '0';
        };

        const critical = getCountById('issue-count-critical');
        const serious = getCountById('issue-count-serious');
        const moderate = getCountById('issue-count-moderate');
        const minor = getCountById('issue-count-minor');
        const total = getCountById('issue-count-total');

        console.log(`[RESULT] ${url} -> Total: ${total}, Crit: ${critical}, Serious: ${serious}`);

        return {
            score: scoreText || 'N/A',
            scanDate: scanDate,
            success: !!scoreText,
            scoreValue: parseFloat(scoreText?.replace('%', '')) || 0,
            minorIssues: minor, 
            // Порядок колонок [пусто, Total, Critical, Serious, Moderate, пусто]
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
        
        // Оновлюємо, якщо дата змінилася АБО якщо ми хочемо оновити статистику помилок (можна прибрати умову lastScan, щоб писати завжди)
        // Для надійності я зараз залишаю запис тільки нових сканів, 
        // але якщо ти хочеш переписати старі неправильні "16" на "1600", треба видалити перевірку дати.
        
        if (!lastScan || lastScan.scan_date !== data.scanDate) {
            console.log(`New data found for project ${project.id}. Saving.`);
            // Ми зберігаємо html issues в null, бо в нас тепер окремі колонки в parsedFields
            db.prepare('INSERT INTO project_scores (project_id, score, scan_date) VALUES (?, ?, ?)')
              .run(project.id, data.scoreValue, data.scanDate);
        }
    }
    return data;
}

module.exports = { updateProjectScore };