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

    console.log('Processing PDF, buffer size:', dataBuffer.length);

    const data = await pdfParse(dataBuffer);
    console.log('PDF parse result:', data ? 'success' : 'failed');

    if (!data || !data.text) {
      throw new Error('PDF parsing returned empty result');
    }

    let text = data.text;
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  } catch (error) {
    console.error('PDF extraction error details:', {
      message: error.message,
      stack: error.stack
    });
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};