const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const port = 3000;

const urls = [
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3116?share=a6292ae96823dd5dfba565e53e18638e19169246',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/392?share=fe8bdb9af9f3c2793634840ec333f43a051afa64',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/466?share=596a45cfecb76a33e0be1863459887da9fab49b8',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1524?share=f0be9e79e7c9c9cf9847d1eec421809393e6280a',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/422?share=ad05b5b10f7ee0cdf946a60bf0453c4139bec1b3',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1701?share=1ef0f05b0590a59bd8f7837060f23b9e4b92f391',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/439?share=8a57b695cda0ba3df87f3e45cb4d41e2b0cb1f61',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1698?share=03fd72f5248b392590e303bb6b318cb0eeaf56ad',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1038?share=3dd6f4cbcd5106262aa41eb484037a796a2ce507',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1062?share=41e933ab6bcb23cf850bfae434e3baa631bdd9e5',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/199?share=1f3da0e83922d07de796e0335997feee4868bc35',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1365?share=52b86ed5cfec8e85da8cf97f1bb4554de906d9ba',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1662?share=69f346a4bc704b1435c0dda569da58789ba1ea6a',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1427?share=400d9d16275b8ba4ef18d74c7eb9261713257339',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/400?share=cb2fe3b60a69924784a9a67a7edb48eef2709c82',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1039?share=2491c204e4c099b2a1fb394f9ada559efc244a1d',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2166?share=33709c96cc39e089e8af62a8dc7c9c944f91b38c',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2171?share=72b99926b91a185b8f06bc302bbe9018cddc94e7',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/998?share=f9ec9b0695b5b173fe4712457ab82082ce237335',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1300?share=4f330929ce7af2f7b3d95364ffa69a12a0314024',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2165?share=c71277f63a10480c167fe9bf38cf81a72f8a93cb',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2169?share=22bafa86964def0050385b464e50b8105b33eaa0',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1329?share=117a20123782cf7d54c7e29f60c912ad95b91499',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1322?share=faf1dbcf2834eb69f60f14a35b8735d25dd3f8a2',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1223?share=51a69669e190fea1b76866333030f67fe9bfd330',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2212?share=3aadb896fac68d2c5fc1d69f384c4ff133237818',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2168?share=183fa74bc8f931ed8c3b682029f888e84655d737',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3111?share=d392d2d8b9298a7fce4a7be51201d02dbf516ede',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2164?share=7a68d40e33ec8a28a47329f957f32dab2960a042',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2167?share=9bf81ec7f4bab1f2c06fce634d3c6384d92a04c5',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3114?share=59698c7f81b1f5f40ae521596ccbe20826f0f36e',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2170?share=7abc6d1c60c16997711ce0a699debdafa9addcf9',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3109?share=04776559ce0d7c842ed8635eb84995e5747743fe',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3110?share=588cf4616a6145c64fb31ea441745ee3ba9e5d4a',
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2394?share=fc31fd87041dd3359ef4015eba0d4a9f4b447726'
];

async function fetchData(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        console.error(`Error fetching data from ${url}: ${error}`);
        return null;
    }
}

function parseTable(html, url) {
    const $ = cheerio.load(html);
    const table = $('#workspaceSummary'); // Adjust the selector to target the specific table if needed
    const rows = table.find('tbody tr');
    const result = [];

    if (rows.length > 0) {
        // Extract the second row and 8 columns
        const secondRow = $(rows[0]).find('th, td').slice(0, 8).map((i, el) => $(el).text().trim()).get();

        // Add 1 additional column with data from a different selector
        const additionalData1 = $('#scanCompleteDate').text().trim(); // Replace '#scanCompleteDate' with the actual ID selector

        secondRow.push(additionalData1);
        secondRow[0] = `<a href="${url}">${secondRow[0]}</a>`; // Add link to the first column
        result.push(secondRow);
    } else {
        // If the second row is absent, use the text under the #active_project selector
        const projectName = $('#active_project').text().trim();
        result.push([`<a href="${url}">${projectName}</a>`, '', '', '', '', '', '', '', 'Failed']);
    }

    return result;
}

function generateHTMLTable(data) {
    let html = '<table border="1" style="width: 100%; border-collapse: collapse;">\n';

    data.forEach(row => {
        html += '  <tr>\n';
        row.forEach(cell => {
            html += `    <td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>\n`;
        });
        html += '  </tr>\n';
    });

    html += '</table>';
    return html;
}

app.get('/', async (req, res) => {
    const allData = [];

    // Add table headers
    const headers = ['Website', 'Score', 'Issues per Page', 'Total', 'Critical', 'Serious', 'Moderate', 'Good', 'Scan status'];
    allData.push(headers);

    for (const url of urls) {
        const html = await fetchData(url);

        if (html) {
            const parsedData = parseTable(html, url);
            allData.push(...parsedData);
        } else {
            console.error(`Failed to fetch data from ${url}`);
        }
    }

    const tableHTML = generateHTMLTable(allData);
    const fullHTML = `
        <html>
        <head>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                }
                th {
                    background-color: #f2f2f2;
                    text-align: left;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #ddd;
                }
            </style>
        </head>
        <body>
            ${tableHTML}
        </body>
        </html>
    `;
    res.send(fullHTML);
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});