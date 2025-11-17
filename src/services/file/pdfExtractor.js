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

    // Try the original approach first
    try {
      const data = await pdfParse(dataBuffer);
      let text = data.text;
      text = text.replace(/\s+/g, ' ');
      text = text.replace(/\n{3,}/g, '\n\n');
      text = text.trim();
      return text;
    } catch (parseError) {
      // If original fails, try class-based approach
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse();
      const data = await parser.parseBuffer(dataBuffer);
      let text = data.text;
      text = text.replace(/\s+/g, ' ');
      text = text.replace(/\n{3,}/g, '\n\n');
      text = text.trim();
      return text;
    }
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};
