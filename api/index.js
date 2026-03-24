
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const JobResearchAgent = require('../ai-agent');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const agent = new JobResearchAgent();

app.post('/api/run-agent', async (req, res) => {
    try {
        const jobs = await agent.runFullCycle();
        res.json({status:"success", jobs});
    } catch (error) {
        res.status(500).json({status:"error", message:error.message});
    }
});

app.post('/api/generate-pdf', async (req, res) => {
    const {title, company, skills} = req.body;

    const cover = await agent.generateCoverLetter(title, company, skills);

    const doc = new PDFDocument();
    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Length": Buffer.byteLength(pdfData)
        }).end(pdfData);
    });

    doc.fontSize(18).text("Cover Letter");
    doc.moveDown();
    doc.fontSize(12).text(cover);

    doc.end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
