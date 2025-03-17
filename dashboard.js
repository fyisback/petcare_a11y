// dashboard.js
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;  // Set default port for Render or Docker

// List of URLs to scrape
const urls = [
    'https://nestle-axemonitor.dequecloud.com/worldspace/organizationProject/summary/3116?share=a6292ae96823dd5dfba565e53e18638e19169246',
    // Add the rest of your URLs here
];

// Function to fetch HTML data from a URL
async function fetchData(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        console.error(`Error fetching data from ${url}: ${error}`);
        return null;
    }
}

// Function to parse the table data from HTML
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

// Function to generate the HTML table from the parsed data
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

// Server route to display the data as an HTML table
app.get('/', async (req, res) => {
    const allData = [];

    // Add table headers
    const headers = ['Website', 'Score', 'Issues per Page', 'Total', 'Critical', 'Serious', 'Moderate', 'Good', 'Scan status'];
    allData.push(headers);

    // Fetch and parse data from each URL
    for (const url of urls) {
        const html = await fetchData(url);

        if (html) {
            const parsedData = parseTable(html, url);
            allData.push(...parsedData);
        } else {
            console.error(`Failed to fetch data from ${url}`);
        }
    }

    // Generate the final HTML table and wrap it in a styled HTML document
    const tableHTML = generateHTMLTable(allData);
    const fullHTML = `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                }
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

// Start the Express server
function startServer() {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

module.exports = startServer;  // Export the function to start the server
