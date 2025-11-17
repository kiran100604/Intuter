const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

exports.extractTextFromPDF = async (input) => {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else {
      dataBuffer = await fs.readFile(input);
    }

    const data = await pdfParse(dataBuffer);
    let text = data.text;
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};