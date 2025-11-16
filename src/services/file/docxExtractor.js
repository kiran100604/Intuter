const mammoth = require('mammoth');

exports.extractTextFromDOCX = async (input) => {
  try {
    const result = await mammoth.extractRawText({ path: input });
    let text = result.value;
    text = text.replace(/\s+/g, ' ');
    text = text.trim();
    return text;
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
};
