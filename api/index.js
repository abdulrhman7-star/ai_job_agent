const express = require('express');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const JobResearchAgent = require('../ai-agent'); // استدعاء الوكيل الذكي

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const agent = new JobResearchAgent();

// مسار تشغيل الوكيل الذكي لجلب وظائف جديدة
app.post('/api/run-agent', async (req, res) => {
    try {
        // تشغيل دورة الوكيل (البحث -> الاستخراج -> الحفظ)
        const jobs = await agent.runFullCycle();
        res.json({ status: "success", jobs: jobs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// مسار جلب الوظائف المحفوظة مسبقاً من Google Sheets
app.get('/api/saved-jobs', async (req, res) => {
    try {
        const response = await axios.get(agent.GOOGLE_SHEET_URL);
        // نعيد البيانات المحفوظة لعرضها في الواجهة
        res.json({ status: "success", data: response.data.data });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Failed to fetch saved jobs" });
    }
});

// مسار توليد PDF Cover Letter
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { title, company, skills } = req.body;
        
        // استخدام الوكيل لتأليف الرسالة
        const coverLetterText = await agent.generateCoverLetter(title, company, skills);

        // إنشاء ملف الـ PDF
        const doc = new PDFDocument({ margin: 50 });
        let buffers =[];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            res.writeHead(200, {
                'Content-Length': Buffer.byteLength(pdfData),
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment;filename=CoverLetter_${company.replace(/\s/g,'')}.pdf`,
            }).end(pdfData);
        });

        // تنسيق الـ PDF
        doc.fontSize(20).text('Cover Letter', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Position: ${title}`, { align: 'left' });
        doc.text(`Company: ${company}`, { align: 'left' });
        doc.moveDown();
        doc.fontSize(12).text(coverLetterText, { align: 'left', lineGap: 4 });
        doc.end();

    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

// نقطة الإطلاق Vercel أو المحلي
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// السطر الأهم لمنصة Vercel
module.exports = app;
