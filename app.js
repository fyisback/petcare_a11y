// app.js
const fs = require('fs');
const path = require('path');

// Path to the file you want to open and run
const filePath = path.join(__dirname, 'dashboard.js');

// Read the file content
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }
  
  // Run the content of the file using eval (for simplicity)
  try {
    eval(data);
  } catch (error) {
    console.error('Error executing the script:', error);
  }
});
