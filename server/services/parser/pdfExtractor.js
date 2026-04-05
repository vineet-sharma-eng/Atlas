const fs = require('fs/promises');
const pdfParseModule = require('pdf-parse');

async function extractPdfText(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const PDFParse =
    pdfParseModule.PDFParse ||
    pdfParseModule.default?.PDFParse ||
    pdfParseModule.default;

  if (typeof PDFParse === 'function') {
    const parser = new PDFParse({ data: fileBuffer });

    if (typeof parser.getText === 'function') {
      try {
        const result = await parser.getText();
        return (result.text || '').trim();
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
    }
  }

  if (typeof pdfParseModule === 'function') {
    const result = await pdfParseModule(fileBuffer);
    return (result.text || '').trim();
  }

  if (typeof pdfParseModule.default === 'function') {
    const result = await pdfParseModule.default(fileBuffer);
    return (result.text || '').trim();
  }

  throw new Error('Unsupported pdf-parse module format');
}

module.exports = {
  extractPdfText,
};
