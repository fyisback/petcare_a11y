const puppeteer = require('puppeteer');

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            const listContainer = document.querySelector('div[role="list"]') 
                               || document.querySelector('.e189e1003d6c')
                               || document.scrollingElement;

            let totalHeight = 0;
            const distance = 200;
            const timer = setInterval(() => {
                const scrollHeight = listContainer.scrollHeight;
                if(listContainer.scrollBy) listContainer.scrollBy(0, distance);
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight || totalHeight > 15000){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function scrapeProjectDetails(projectUrl) {
    let browser;
    try {
        console.log(`[Scraper] 🚀 Launching: ${projectUrl}`);
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        await page.goto(projectUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // 1. Шукаємо лінк "Total"
        const totalLinkSelector = 'a[aria-describedby*="issue-count-total"]';
        try {
            await page.waitForSelector(totalLinkSelector, { timeout: 15000 });
        } catch (e) {
            console.warn(`[Scraper] ⚠️ 'Total' link not found.`);
            return { issues: [], url: null };
        }

        const issuesHref = await page.$eval(totalLinkSelector, el => el.href);
        const urlObj = new URL(issuesHref);
        const scanRunID = urlObj.searchParams.get('scanRun');

        if (!scanRunID) {
            console.error(`[Scraper] ❌ No scanRun ID.`);
            return { issues: [], url: null };
        }

        // 2. Формуємо URL
        const baseUrl = 'https://nestle-axemonitor.dequecloud.com/monitor/issues';
        const targetUrl = `${baseUrl}?scanRun=${encodeURIComponent(scanRunID)}&severity=1,2,4&status=open`;
        
        console.log(`[Scraper] ➡️ Issues URL: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 });

        // 3. Чекаємо список
        try {
            await page.waitForSelector('div[role="listitem"]', { timeout: 20000 });
            await autoScroll(page); 
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.warn(`[Scraper] ⚠️ List items not found.`);
            return { issues: [], url: targetUrl };
        }

        // 4. Парсимо (з екрануванням HTML)
        const issues = await page.evaluate(() => {
            const parseNumber = (str) => {
                if (!str) return 0;
                let text = str.trim().toLowerCase();
                let multiplier = 1;
                if (text.includes('тис') || text.includes('k')) multiplier = 1000;
                if (text.includes('млн') || text.includes('m')) multiplier = 1000000;
                text = text.replace(/[^0-9,.]/g, '').replace(',', '.');
                return Math.floor(parseFloat(text) * multiplier) || 0;
            };

            // Функція екранування (щоб <ul> не ламав таблицю)
            const escapeHtml = (text) => {
                if (!text) return '';
                return text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            const items = document.querySelectorAll('div[role="listitem"]');
            
            return Array.from(items).map(item => {
                // Шукаємо опис: спочатку по класу, потім по тегу label
                let descEl = item.querySelector('.Field__label') || item.querySelector('label');
                let description = descEl ? descEl.innerText.trim() : 'Unknown Issue';
                
                // Екрануємо опис!
                description = escapeHtml(description);

                // Pages
                const pagesLinkEl = item.querySelector('a.TagButton');
                let pagesCount = 0;
                let issueLink = null;

                if (pagesLinkEl) {
                    issueLink = pagesLinkEl.href;
                    const text = pagesLinkEl.innerText.replace(/Pages:/i, '').trim();
                    pagesCount = parseNumber(text);
                }

                // Issues
                // Шукаємо всі елементи з текстом "Issues:"
                // (більш надійний пошук через XPath або перебір всіх елементів)
                let issuesCount = 0;
                const allElements = item.querySelectorAll('*');
                for (let el of allElements) {
                    if (el.innerText && el.innerText.includes('Issues:')) {
                        // Знайшли блок з Issues, шукаємо цифру поруч
                        const numEl = el.querySelector('.weight--medium') || el.querySelector('button');
                        const rawVal = numEl ? numEl.innerText : el.innerText.replace(/Issues:/i, '');
                        issuesCount = parseNumber(rawVal);
                        if (issuesCount > 0) break; // Знайшли - виходимо
                    }
                }

                // Якщо опис Unknown, але є цифри - це дивно, спробуємо знайти будь-який текст заголовка
                if (description === 'Unknown Issue') {
                    const heading = item.querySelector('[role="heading"]');
                    if (heading) description = escapeHtml(heading.innerText.trim());
                }

                return {
                    description,
                    severity: 'Critical',
                    pages_count: pagesCount,
                    issues_count: issuesCount,
                    issue_link: issueLink
                };
            });
        });

        // Фільтруємо "порожні" (Unknown Issue з 0 помилок)
        const validIssues = issues.filter(i => i.issues_count > 0 || i.pages_count > 0);

        console.log(`[Scraper] ✅ Found ${validIssues.length} valid issues.`);
        return { issues: validIssues, url: targetUrl };

    } catch (error) {
        console.error('[Scraper] Error:', error);
        return { issues: [], url: null };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeProjectDetails };