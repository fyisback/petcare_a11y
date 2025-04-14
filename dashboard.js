const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const pLimit = require('p-limit').default; // Correct import for p-limit

const app = express();
const port = process.env.PORT || 10000; // Allow custom port via environment variable

// List of URLs to scrape
const urls = [
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3116?share=a6292ae96823dd5dfba565e53e18638e19169246', 'https://nestle.sharepoint.com/teams/PersonalizationScale2/Shared%20Documents/Forms/AllItems.aspx?id=%2Fteams%2FPersonalizationScale2%2FShared%20Documents%2FNBM%20Digital%20Product%20Team%2FAccessibility%2FAccessibility%20AxeMonitor%20reports%2FMarch%2Fchowcontest%2Epurina%2Ecom&viewid=a4887429%2D5869%2D4097%2Db45a%2Defc375c7b766&csf=1&web=1&e=HUat2H&cid=10f02d2b%2D17a8%2D48b7%2Da82f%2Da33668116148&FolderCTID=0x012000219D770CF1C62848A1EE1CF14DD8E888', 'ThirdParty'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/392?share=fe8bdb9af9f3c2793634840ec333f43a051afa64', 'https://nestle.sharepoint.com/teams/PersonalizationScale2/Shared%20Documents/Forms/AllItems.aspx?id=%2Fteams%2FPersonalizationScale2%2FShared%20Documents%2FNBM%20Digital%20Product%20Team%2FAccessibility%2FAccessibility%20AxeMonitor%20reports%2FMarch%2Feverroot%2Ecom&viewid=a4887429%2D5869%2D4097%2Db45a%2Defc375c7b766&csf=1&web=1&e=HUat2H&cid=10f02d2b%2D17a8%2D48b7%2Da82f%2Da33668116148&FolderCTID=0x012000219D770CF1C62848A1EE1CF14DD8E888', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/466?share=596a45cfecb76a33e0be1863459887da9fab49b8', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/439?share=8a57b695cda0ba3df87f3e45cb4d41e2b0cb1f61', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1415?share=af0bb053e8bd7cf5ccfc151b9287de0c88eef156', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1698?share=03fd72f5248b392590e303bb6b318cb0eeaf56ad', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1038?share=3dd6f4cbcd5106262aa41eb484037a796a2ce507', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1062?share=41e933ab6bcb23cf850bfae434e3baa631bdd9e5', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/199?share=1f3da0e83922d07de796e0335997feee4868bc35', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1365?share=52b86ed5cfec8e85da8cf97f1bb4554de906d9ba', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1662?share=69f346a4bc704b1435c0dda569da58789ba1ea6a', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1039?share=2491c204e4c099b2a1fb394f9ada559efc244a1d', 'https://example.com', 'NBM'],
    
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/998?share=f9ec9b0695b5b173fe4712457ab82082ce237335', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1300?share=4f330929ce7af2f7b3d95364ffa69a12a0314024', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2169?share=22bafa86964def0050385b464e50b8105b33eaa0', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1329?share=117a20123782cf7d54c7e29f60c912ad95b91499', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3111?share=d392d2d8b9298a7fce4a7be51201d02dbf516ede', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2164?share=7a68d40e33ec8a28a47329f957f32dab2960a042', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2167?share=9bf81ec7f4bab1f2c06fce634d3c6384d92a04c5', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3114?share=59698c7f81b1f5f40ae521596ccbe20826f0f36e', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2170?begin=02-19-2025&end=03-25-2025&potentialIssues=off&share=7abc6d1c60c16997711ce0a699debdafa9addcf9', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3109?share=04776559ce0d7c842ed8635eb84995e5747743fe', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2394?share=fc31fd87041dd3359ef4015eba0d4a9f4b447726', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1325?share=be8dd44d1d4a3a2a2ae974a0850f712c794b985e', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1323?share=3002578ebfc795b8c2b11376aa3954305d506742', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1370?share=7df8933af445d21ff1d7781adfeead2dc87d8078', 'https://example.com', 'NBM']
];

// Define a new variable similar to 'urls' for the 'On Hold' table
const onHoldUrls = [
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2171?share=72b99926b91a185b8f06bc302bbe9018cddc94e7', 'https://example.com', 'ThirdParty'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3110?share=588cf4616a6145c64fb31ea441745ee3ba9e5d4a', 'https://example.com', 'ThirdParty']
    // Add more rows as needed
];

const limit = pLimit(5);

function fetchData(url, retries = 3) {
    return axios.get(url).then(res => res.data).catch(err => {
        if (err.response && err.response.status === 404 && retries > 0) {
            console.error(`404 Error fetching ${url}. Retrying...`);
            return new Promise(resolve => setTimeout(resolve, 500)).then(() =>
                fetchData(url, retries - 1)
            );
        } else {
            console.error(`Error fetching ${url}: ${err.message}`);
            return null;
        }
    });
}

function parseTable(html, url) {
    const $ = cheerio.load(html);
    const table = $('#workspaceSummary');
    const rows = table.find('tbody tr');
    const result = [];

    if (rows.length > 0) {
        const row = $(rows[0]).find('th, td').slice(0, 8).map((i, el) => $(el).text().trim()).get();
        const additionalData1 = $('#scanCompleteDate').text().trim();

        row.push(additionalData1);
        row[0] = `<a href="${url}">${row[0]}</a>`;
        result.push(row);
    } else {
        const projectName = $('#active_project').text().trim();
        result.push([`<a href="${url}">${projectName}</a>`, '', '', '', '', '', '', '', 'Failed']);
    }

    return result;
}

function generateHTMLTable(data) {
    let html = '<table border="1" style="width: 100%; border-collapse: collapse;">\n';
    const headers = [...data[0], 'Report', 'Category'];
    html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>\n';

    data.slice(1).forEach((row, i) => {
        const score = parseFloat(row[1]);
        let style = '';

        if (!isNaN(score)) {
            if (score < 80) style = 'background-color: red; color: white;';
            else if (score < 90) style = 'background-color: green; color: white;';
            else style = 'background-color: darkgreen; color: white;';
        }

        html += '<tr>' + row.map((cell, j) =>
            `<td${j === 1 ? ` style="${style}"` : ''}>${cell}</td>`
        ).join('');

        const reportLink = urls[i][1];
        const category = urls[i][2];
        const reportButton = reportLink === 'https://example.com'
            ? `<button disabled style="background-color: grey;">Report</button>`
            : `<a href="${reportLink}" target="_blank"><button style="background-color: red; color: white;">Report</button></a>`;

        html += `<td>${reportButton}</td><td>${category}</td></tr>\n`;
    });

    html += '</table>';
    return html;
}

function calculateCategoryAverages(data) {
    const categories = [...new Set(urls.map(url => url[2]))];
    const categoryScores = Object.fromEntries(categories.map(c => [c, { sum: 0, count: 0 }]));

    let totalSum = 0, totalCount = 0;

    data.slice(1).forEach((row, i) => {
        const score = parseFloat(row[1]?.replace('%', '')) || 0;
        const category = urls[i][2];
        categoryScores[category].sum += score;
        categoryScores[category].count += 1;
        totalSum += score;
        totalCount += 1;
    });

    return [
        { category: 'Total', average: (totalSum / totalCount).toFixed(2) },
        ...Object.entries(categoryScores).map(([cat, { sum, count }]) => ({
            category: cat,
            average: count ? (sum / count).toFixed(2) : 'N/A'
        }))
    ];
}

function generateCategoryAverageTable(data) {
    const averages = calculateCategoryAverages(data);
    let html = '<table border="1" style="width: 50%; margin-top: 20px;">\n<tr><th>Category</th><th>Average</th></tr>\n';

    averages.forEach(({ category, average }) => {
        let style = '';
        const score = parseFloat(average);
        if (!isNaN(score)) {
            if (score < 80) style = 'background-color: red; color: white;';
            else if (score < 90) style = 'background-color: green; color: white;';
            else style = 'background-color: darkgreen; color: white;';
        }
        html += `<tr><td>${category}</td><td style="${style}">${average}%</td></tr>\n`;
    });

    html += '</table>';
    return html;
}

// ✅ No async: Fetch On Hold titles using Promises
function generateOnHoldTableWithTitlesNoAsync(callback) {
    const rows = [];

    let completed = 0;
    onHoldUrls.forEach(([projectURL, reportURL, category], i) => {
        fetchData(projectURL).then(html => {
            let title = 'Unavailable';
            if (html) {
                const $ = cheerio.load(html);
                title = $('#active_project').text().trim() || 'Untitled Project';
            }

            const rowHTML = `<tr>
                <td><a href="${projectURL}" target="_blank">${title}</a></td>
                <td><a href="${reportURL}" target="_blank">Report</a></td>
                <td>${category}</td>
            </tr>`;
            rows[i] = rowHTML;
        }).catch(() => {
            rows[i] = `<tr><td><a href="${projectURL}">Unavailable</a></td><td><a href="${reportURL}">Report</a></td><td>${category}</td></tr>`;
        }).finally(() => {
            completed++;
            if (completed === onHoldUrls.length) {
                const html = `<table border="1" style="width: 100%; margin-top: 20px;">
<tr><th>Project</th><th>Report Link</th><th>Category</th></tr>
${rows.join('\n')}
</table>`;
                callback(html);
            }
        });
    });
}

app.get('/', (req, res) => {
    const allData = [['Website', 'Score', 'Issues per Page', 'Total', 'Critical', 'Serious', 'Moderate', 'Good', 'Scan status']];

    Promise.all(urls.map(url =>
        limit(() => fetchData(url[0]).then(html => html ? parseTable(html, url[0]) : []))
    )).then(results => {
        results.forEach(parsed => allData.push(...parsed));
        const mainTable = generateHTMLTable(allData);
        const avgTable = generateCategoryAverageTable(allData);

        generateOnHoldTableWithTitlesNoAsync(onHoldTable => {
            const html = `
                <html>
                <head>
                    <title>Accessibility Dashboard</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; }
                        h1, h2 { font-weight: 300; }
                        .header { background-color: #E91B23; color: white; padding: 10px; text-align: center; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                        tr:hover { background-color: #f2f2f2; }
                        a { color: black; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="header"><h1>PetCare NA Dashboard</h1></div>
                    ${mainTable}
                    ${avgTable}
                    <h2>On Hold</h2>
                    ${onHoldTable}
                </body>
                </html>
            `;
            res.send(html);
        });
    });
});

function startServer() {
    app.listen(port, '0.0.0.0', () => { // Bind to 0.0.0.0
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
}

module.exports = startServer;