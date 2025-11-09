require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const app = express();

const upload = multer({ dest: 'uploads/' }); // temporary upload folder

// Single file upload endpoint
app.post('/api/uploadShopify', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileData = fs.readFileSync(req.file.path, { encoding: 'base64' });
  const fileName = req.file.originalname;

  try {
    const response = await axios.post(
      `https://${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_PASSWORD}@${process.env.SHOPIFY_STORE}/admin/api/2025-01/files.json`,
      {
        file: {
          attachment: fileData,
          filename: fileName
        }
      }
    );

    fs.unlinkSync(req.file.path); // delete temp file
    res.json({ url: response.data.file.public_url }); // return Shopify public URL
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to upload to Shopify' });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
