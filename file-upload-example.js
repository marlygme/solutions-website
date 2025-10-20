
const R2Storage = require('./r2-storage');
const multer = require('multer');
const express = require('express');

const storage = new R2Storage();
const upload = multer({ storage: multer.memoryStorage() });

// Example API endpoint for file upload
app.post('/api/upload/:clientId', upload.single('file'), async (req, res) => {
    try {
        const { clientId } = req.params;
        const { type, subPath } = req.body;
        const file = req.file;

        const result = await storage.uploadClientFile(
            clientId,
            type,
            file.originalname,
            file.buffer,
            file.mimetype,
            subPath
        );

        if (result.success) {
            res.json({ message: 'File uploaded successfully', file: result });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example API endpoint for listing files
app.get('/api/files/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { type } = req.query;

        const result = await storage.listClientFiles(clientId, type);

        if (result.success) {
            res.json(result.files);
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
