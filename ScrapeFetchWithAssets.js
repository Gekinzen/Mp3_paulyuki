/*P.Yuki Scraper and fetch miner data v1.020231116*/
const axios = require('axios');
const cheerio = require('cheerio'); /*also used cheerio*/
const fs = require('fs');
const path = require('path');

const fetchPage = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Unable to fetch the page ${url}: ${error.message}`);
  }
};

const downloadAsset = async (url, outputFilename) => { /*This functionm I used modification that can handle and prevent errors  fonts.googleapis.com and skips downloading assets */
  try {
    // Skip downloading assets from specific domains or types
    if (url.includes('fonts.googleapis.com')) {
      console.error(`Skipping download for Google Fonts resource: ${url}`);
      return;
    }

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer', // To handle images or binary files
      validateStatus: (status) => status < 400, // Validate status codes below 400 (i.e., success codes)
    });

    if (response.status === 404) {
      console.error(`Error: Asset not found - ${url}`);
      return; // Skip saving the asset if it's not found
    }

    fs.writeFileSync(outputFilename, response.data);
  } catch (error) {
    console.error(`Error downloading asset from ${url}: ${error.message}`);
  }
};

const updateAssetReferences = ($, originalUrl, localPath) => {
  const assetTags = ['img', 'link', 'script'];

  assetTags.forEach((tag) => {
    $(tag).each(function () {
      let attribute = '';
      switch (tag) {
        case 'img':
          attribute = 'src';
          break;
        case 'link':
          attribute = 'href';
          break;
        case 'script':
          attribute = 'src';
          break;
        default:
          break;
      }

      const assetUrl = $(this).attr(attribute);
      if (assetUrl && !assetUrl.startsWith('data:') && !assetUrl.startsWith('http')) {
        const absoluteUrl = new URL(assetUrl, originalUrl).href;
        const assetFilename = path.basename(assetUrl);
        const localAssetPath = path.join(localPath, assetFilename);
        $(this).attr(attribute, assetFilename);
        downloadAsset(absoluteUrl, localAssetPath);
      }
    });
  });

  return $;
};

const savePageWithAssets = async (url) => {
  try {
    const pageContent = await fetchPage(url);
    const $ = cheerio.load(pageContent);
    const metadata = {
      num_links: $('a').length,
      images: $('img').length,
      last_fetch: new Date().toUTCString(),
    };

    // Create a directory for the assets
    const outputDir = path.join(__dirname, path.basename(url));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const updatedHTML = updateAssetReferences($, url, outputDir);

    const fileName = `${path.basename(url)}.html`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, updatedHTML.html());
    console.log(`Page saved successfully at ${filePath}`);

    console.log(`site: ${url}`);
    console.log(`num_links: ${metadata.num_links}`);
    console.log(`images: ${metadata.images}`);
    console.log(`last_fetch: ${metadata.last_fetch}`);
  } catch (error) {
    console.error(error.message);
  }
};

const url = process.argv[2];

if (!url) {
  console.error('Please provide a URL.');
  process.exit(1);
}

savePageWithAssets(url);
