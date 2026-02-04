const fs = require('fs');
const path = require('path');
const https = require('https');

// Tesseract.js language data repository
const LANG_DATA_URL = 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0';

// Languages to download (can be overridden by environment variable)
const LANGUAGES = (process.env.OCR_LANGUAGES || 'eng+chi_sim').split('+');

// Target directory for language data
const LANG_DIR = path.join(__dirname, '..', 'node_modules', 'tesseract.js-core', 'lang-data');

/**
 * Download a file from URL
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

/**
 * Main function to download language files
 */
async function downloadLanguages() {
  console.log('[Tesseract] Downloading language data files...');
  console.log('[Tesseract] Languages:', LANGUAGES.join(', '));

  // Create language directory if it doesn't exist
  if (!fs.existsSync(LANG_DIR)) {
    fs.mkdirSync(LANG_DIR, { recursive: true });
    console.log('[Tesseract] Created directory:', LANG_DIR);
  }

  for (const lang of LANGUAGES) {
    const filename = `${lang}.traineddata.gz`;
    const url = `${LANG_DATA_URL}/${filename}`;
    const dest = path.join(LANG_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(dest)) {
      console.log(`[Tesseract] ✓ ${lang} - already exists`);
      continue;
    }

    try {
      console.log(`[Tesseract] ⬇ Downloading ${lang}...`);
      await downloadFile(url, dest);
      console.log(`[Tesseract] ✓ ${lang} - downloaded successfully`);
    } catch (error) {
      console.error(`[Tesseract] ✗ ${lang} - failed:`, error.message);
    }
  }

  console.log('[Tesseract] Language data download completed!');
}

// Run if executed directly
if (require.main === module) {
  downloadLanguages().catch((error) => {
    console.error('[Tesseract] Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { downloadLanguages };
