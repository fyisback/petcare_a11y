const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const pLimit = require('p-limit').default; // Correct import for p-limit

const app = express();
const port = process.env.PORT || 10000; // Set default port for Render or Docker

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
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2171?begin=02-16-2025&end=04-15-2025&potentialIssues=off&share=72b99926b91a185b8f06bc302bbe9018cddc94e7', 'https://example.com', 'ThirdParty'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/998?share=f9ec9b0695b5b173fe4712457ab82082ce237335', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1300?share=4f330929ce7af2f7b3d95364ffa69a12a0314024', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2169?share=22bafa86964def0050385b464e50b8105b33eaa0', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1329?share=117a20123782cf7d54c7e29f60c912ad95b91499', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3111?share=d392d2d8b9298a7fce4a7be51201d02dbf516ede', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2164?share=7a68d40e33ec8a28a47329f957f32dab2960a042', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2167?share=9bf81ec7f4bab1f2c06fce634d3c6384d92a04c5', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3114?share=59698c7f81b1f5f40ae521596ccbe20826f0f36e', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2170?begin=02-19-2025&end=03-25-2025&potentialIssues=off&share=7abc6d1c60c16997711ce0a699debdafa9addcf9', 'https://example.com', 'NPPC'],

    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/2394?share=fc31fd87041dd3359ef4015eba0d4a9f4b447726', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1325?share=be8dd44d1d4a3a2a2ae974a0850f712c794b985e', 'https://example.com', 'NPPC'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1323?share=3002578ebfc795b8c2b11376aa3954305d506742', 'https://example.com', 'NBM'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/1370?share=7df8933af445d21ff1d7781adfeead2dc87d8078', 'https://example.com', 'NBM']
];

// Define a new variable similar to 'urls' for the 'On Hold' table
const onHoldUrls = [
   
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3110?share=588cf4616a6145c64fb31ea441745ee3ba9e5d4a', 'https://example.com', 'ThirdParty', 'US_PURINA_DIG0072312_treatrewards.purina.com'],
    ['https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3109?share=04776559ce0d7c842ed8635eb84995e5747743fe', 'https://example.com', 'NBM', 'US_PURINA_DIG0065584_welcome.purina.com']
    // Add more rows as needed
];

// Initialize the p-limit with concurrency limit of 5 requests at once
const limit = pLimit(5);

// Retry mechanism and fetching data with error handling
async function fetchData(url, retries = 3) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        if (error.response && error.response.status === 404 && retries > 0) {
            console.error(`404 Error fetching data from ${url}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 2 seconds before retry
            return fetchData(url, retries - 1); // Retry if not yet reached max retries
        } else {
            console.error(`Error fetching data from ${url}: ${error.message}`);
            return null;
        }
    }
}

// Parse table data from HTML
function parseTable(html, url) {
    const $ = cheerio.load(html);
    const table = $('#workspaceSummary'); // Adjust the selector to target the specific table
    const rows = table.find('tbody tr');
    const result = [];

    if (rows.length > 0) {
        // Extract the second row and 8 columns
        const secondRow = $(rows[0]).find('th, td').slice(0, 8).map((i, el) => $(el).text().trim()).get();

        // Add 1 additional column with data from a different selector
        const additionalData1 = $('#scanCompleteDate').text().trim(); // Replace with actual selector

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

// Generate the HTML table from the parsed data
function generateHTMLTable(data) {
    let html = '<table border="1" style="width: 100%; border-collapse: collapse;">\n';

    // Add table headers
    const headers = [...data[0], 'Report', 'Category']; // Add "Category" header
    html += '  <tr>\n';
    headers.forEach(header => {
        html += `<th>${header}</th>\n`;
    });
    html += '  </tr>\n';

    // Add table rows
    data.slice(1).forEach((row, rowIndex) => {
        const score = parseFloat(row[1]);
        let cellStyle = '';

        if (!isNaN(score)) {
            if (score < 80) {
                cellStyle = 'background-color: red; color: white;';
            } else if (score >= 80 && score < 90) {
                cellStyle = 'background-color: green; color: white;';
            } else if (score >= 90) {
                cellStyle = 'background-color: darkgreen; color: white;';
            }
        }

        html += '  <tr>\n';
        row.forEach((cell, index) => {
            if (index === 1) {
                html += `<td style="${cellStyle}">${cell}</td>\n`;
            } else {
                html += `<td>${cell}</td>\n`;
            }
        });

        // Add the report column
        const reportLink = urls[rowIndex][1];
        const reportButton = reportLink === 'https://example.com'
            ? `<button disabled style="background-color: grey; color: white; border: none; padding: 5px 10px; cursor: not-allowed;">Report</button>`
            : `<a href="${reportLink}" target="_blank"><button style="background-color: red; color: white; border: none; padding: 5px 10px; cursor: pointer;">Report</button></a>`;
        html += `<td>${reportButton}</td>\n`;

        // Add the category column from `urls`
        const category = urls[rowIndex]?.[2];
        html += `<td>${category}</td>\n`;

        html += '  </tr>\n';
    });

    html += '</table>';
    return html;
}

// Extract categories dynamically from the third column of the `urls` matrix
const categories = [...new Set(urls.map(url => url[2]))]; // Create a unique list of categories

console.log('Extracted Categories:', categories);

// Function to calculate the average score for each category and total average
function calculateCategoryAverages(data) {
    const categoryScores = categories.reduce((acc, category) => {
        acc[category] = { sum: 0, count: 0 };
        return acc;
    }, {});

    let totalSum = 0;
    let totalCount = 0;

    // Iterate through all rows, starting from index 1 (skip header row)
    data.slice(1).forEach((row, rowIndex) => {
        const rawScore = row[1]; // Extract score from the second column
        const score = parseFloat(rawScore?.replace('%', '')) || 0; // Ensure 0 is counted
        const category = urls[rowIndex]?.[2]; // Use the third column of the `urls` variable for category mapping

        console.log(`Row ${rowIndex + 1}: Score = "${rawScore}", Parsed Score = ${score}, Category = "${category}"`);

        if (!categories.includes(category)) {
            console.log(`Skipping row ${rowIndex + 1} due to invalid category.`);
            return;
        }

        // Update category-specific scores
        categoryScores[category].sum += score;
        categoryScores[category].count += 1;

        // Update total scores
        totalSum += score;
        totalCount += 1;

        // Log the updated category scores
        console.log(`Category "${category}": Added ${score} to sum (${categoryScores[category].sum}), Count = ${categoryScores[category].count}`);
    });

    // Compute category averages
    const averages = Object.entries(categoryScores).map(([category, { sum, count }]) => ({
        category,
        average: count > 0 ? (sum / count).toFixed(2) : 'N/A',
    }));

    // Add total average to the averages list
    averages.unshift({
        category: 'Total',
        average: totalCount > 0 ? (totalSum / totalCount).toFixed(2) : 'N/A',
    });

    return averages;
}

// Function to generate the table with category averages and total average
function generateCategoryAverageTable(data) {
    const averages = calculateCategoryAverages(data);

    let html = '<table border="1" style="width: 50%; border-collapse: collapse; margin-top: 20px;">\n';
    html += '  <tr><th>Category</th><th>Average Score</th></tr>\n';

    averages.forEach(({ category, average }) => {
        let cellStyle = '';

        if (!isNaN(parseFloat(average))) {
            if (average < 80) {
                cellStyle = 'background-color: red; color: white;';
            } else if (average >= 80 && average < 90) {
                cellStyle = 'background-color: green; color: white;';
            } else if (average >= 90) {
                cellStyle = 'background-color: darkgreen; color: white;';
            }
        }

        html += `  <tr><td>${category}</td><td style="${cellStyle}">${average}%</td></tr>\n`;
    });

    html += '</table>';
    return html;
}

// Function to generate the 'On Hold' table
function generateOnHoldTable(data) {
    let html = '<table border="1" style="width: 100%; border-collapse: collapse; margin-top: 20px;">\n';
    html += '  <tr><th>Project</th><th>Report Link</th><th>Category</th></tr>\n';

    data.forEach(row => {
        html += '  <tr>\n';

        // Parse the first column to display a title linked to the project
        const projectLink = row[0];
        const projectTitle = projectLink.split('/').pop().split('?')[0]; // Extract title from the URL
        html += `<td><a href="${projectLink}" target="_blank">${projectTitle}</a></td>\n`;

        // Add the report link
        const reportLink = row[1];
        html += `<td><a href="${reportLink}" target="_blank">Report</a></td>\n`;

        // Add the category
        const category = row[2];
        html += `<td>${category}</td>\n`;

        html += '  </tr>\n';
    });

    html += '</table>';
    return html;
}

// Server route to display the data as an HTML table
app.get('/', async (req, res) => {
    const allData = [];

    // Add table headers
    const headers = ['Website', 'Score', 'Issues per Page', 'Total', 'Critical', 'Serious', 'Moderate', 'Good', 'Scan status'];
    allData.push(headers);

    // Fetch and parse data from each URL concurrently, using p-limit to limit concurrency to 5
    const fetchPromises = urls.map(url => limit(() => fetchData(url[0]).then(html => {
        if (html) {
            return parseTable(html, url[0]);
        } else {
            console.error(`Failed to fetch data from ${url[0]}`);
            return [];
        }
    })));

    // Wait for all fetch promises to resolve
    const results = await Promise.all(fetchPromises);
    results.forEach(parsedData => {
        allData.push(...parsedData);
    });

    // Generate the first HTML table with categories column
    const tableHTML = generateHTMLTable(allData);

    // Calculate category averages only after the categories column is added
    const categoryAverageTableHTML = generateCategoryAverageTable(allData); // Use the updated `allData` with added columns

    // Generate the 'On Hold' table
    const onHoldTableHTML = generateOnHoldTable(onHoldUrls);

    // Generate the final HTML response
    const fullHTML = `
        <html>
        <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
            <style>
                h1{ font-weight: lighter; }
                body{
                    font-family: "Inter", sans-serif;
                    font-weight: lighter;
                    margin:1;
                }
                .header {
                    background-color: #E91B23;
                    color: white;
                    text-align: center;
                    padding: 10px;
                    margin-bottom: 0px;
                    border: 1px solid black;
                    border-bottom: none;
                    box-shadow: 0px 0px 10px white;
                }
                table {
                    border: 1px solid black;
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 0px;
                    border-top: none;
                }
                a {
                    color: black;
                }
                th, td {
                    border: 1px solid black;
                    padding: 8px;
                }
                tr:hover {
                    background-color: #ddd;
                }
            </style>
        </head>
        <body>
        <div class="header">
            <h1>PetCare NA Dashboard</h1>
        </div>
            ${tableHTML}
            ${categoryAverageTableHTML}
            <h2>On Hold</h2>
            ${onHoldTableHTML}
        </body>
        </html>
    `;
    res.send(fullHTML);
});

// Start the Express server
function startServer() {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

module.exports = startServer; // Export the function to start the server