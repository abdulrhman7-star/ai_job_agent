const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class JobResearchAgent {
    constructor() {
        // مفاتيح الـ API الخاصة بك (يُفضل وضعها في ملف .env في التطبيقات الحقيقية)
        this.GEMINI_API_KEY = "AIzaSyBsY-89tUsRezCFhnA0rxQ1ZFqpZfY0S_c";
        this.SEARCH_API_KEY = "AIzaSyA-lIOiKuSOGwE9LHMK8XkpJyij-XLakH4";
        this.SEARCH_CX = "66856a3f62dde408a";
        this.GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbz6anhSS4atJw7fo4pD8E_5z4QyMkc3Su43MIv4TpX38h1debJ2Nj8XLZFXyKiedIo/exec";
        
        this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    }

    // 1. توليد استعلامات بحث معقدة (Boolean Queries) ديناميكياً
    generateBooleanQuery() {
        const locations = ['"Saudi Arabia"', 'KSA', '"Qatar"', '"Oman"'];
        const roles =[
            '"software engineer"', '"senior software engineer"', '"frontend engineer"', 
            '"data scientist"', '"IT manager"', '"cybersecurity analyst"', 
            '"devops engineer"', '"product manager"'
        ];
        const companies =[
            '"stc"', '"aramco"', '"EY"', '"Procter & Gamble"', '"IBM"', '"PwC"', 
            '"Riyad Bank"', '"Qatar Airways"', '"Ooredoo"', '"Bank Muscat"'
        ];
        const jobKeywords = '(intitle:jobs OR intitle:careers OR intitle:vacancies OR intitle:وظائف OR inurl:careers)';

        // اختيار عشوائي لتنويع البحث في كل مرة يعمل فيها الوكيل
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        const randomRole = roles[Math.floor(Math.random() * roles.length)];
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];

        // بناء الـ Query
        return `${jobKeywords} ${randomCompany} ${randomRole} ${randomLocation}`;
    }

    // 2. تنفيذ البحث عبر محرك بحث جوجل المخصص
    async executeSearch(query) {
        console.log(`[Agent] Executing Search Query: ${query}`);
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.SEARCH_API_KEY}&cx=${this.SEARCH_CX}&q=${encodeURIComponent(query)}&num=10`;
        
        try {
            const response = await axios.get(searchUrl);
            return response.data.items ||[];
        } catch (error) {
            console.error(`[Agent Error] Search Failed:`, error.message);
            return[];
        }
    }

    // 3. تحليل النتائج واستخراج البيانات الدقيقة باستخدام Gemini
    async analyzeAndExtract(searchResults) {
        if (searchResults.length === 0) return[];
        console.log(`[Agent] Analyzing ${searchResults.length} results with Gemini AI...`);

        const searchContext = searchResults.map(item => 
            `Title: ${item.title}\nURL: ${item.link}\nSnippet: ${item.snippet}`
        ).join('\n\n---\n\n');

        const prompt = `
        You are an Advanced AI Job Intelligence Agent. Analyze the following Google Search results and extract valid job postings.
        Only extract real jobs located in Saudi Arabia, Oman, or Qatar.
        If an HR email or Contact Person is mentioned in the snippet or URL, extract it. Otherwise, guess it based on company standard (e.g. careers@company.com) or leave empty "".
        
        Return STRICTLY a JSON array of objects with these keys:
        - title (Job Title)
        - company (Company Name)
        - country (Saudi Arabia, Oman, or Qatar)
        - city (Specific city if mentioned, else "")
        - applyLink (The URL)
        - hrEmail (HR Email if found, else "")
        - visaSponsorship (true/false/null based on context)
        - skills (Array of short string skills extracted)
        
        Search Results to Analyze:
        ${searchContext}
        `;

        try {
            const result = await this.model.generateContent(prompt);
            let responseText = result.response.text();
            
            // تنظيف النص للحصول على JSON نقي
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const extractedJobs = JSON.parse(responseText);
            return extractedJobs;
        } catch (error) {
            console.error(`[Agent Error] Gemini Extraction Failed:`, error.message);
            return[];
        }
    }

    // 4. حفظ البيانات المنظمة في قاعدة البيانات (Google Sheets)
    async saveToDatabase(jobList) {
        console.log(`[Agent] Saving ${jobList.length} jobs to Google Sheets...`);
        let savedCount = 0;
        
        for (const job of jobList) {
            try {
                await axios.post(this.GOOGLE_SHEET_URL, {
                    title: job.title,
                    company: job.company,
                    country: job.country,
                    city: job.city || "N/A",
                    applyLink: job.applyLink,
                    hrEmail: job.hrEmail || "N/A"
                });
                savedCount++;
            } catch (error) {
                console.error(`[Agent Error] Failed to save job: ${job.title}`);
            }
        }
        return savedCount;
    }

    // 5. توليد Cover Letter مخصص للوظيفة
    async generateCoverLetter(jobTitle, companyName, skills) {
        const prompt = `
        Write a highly professional, ATS-optimized cover letter for the position of "${jobTitle}" at "${companyName}".
        The candidate possesses the following skills: ${skills ? skills.join(', ') : 'IT, Software Engineering, Management'}.
        Keep it concise, structured, and ready to be exported as a PDF. 
        Do not include placeholders like [Your Name] in the main body, just write the core letter.
        `;
        
        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            return "Error generating cover letter. Please try manually.";
        }
    }

    // 6. تشغيل دورة الوكيل الكاملة (Agentic Loop)
    async runFullCycle() {
        console.log("=== AI Job Agent Started ===");
        const query = this.generateBooleanQuery();
        const results = await this.executeSearch(query);
        
        if (results.length > 0) {
            const extractedJobs = await this.analyzeAndExtract(results);
            const savedCount = await this.saveToDatabase(extractedJobs);
            console.log(`=== Cycle Complete: Found ${extractedJobs.length} jobs, Saved ${savedCount} ===`);
            return extractedJobs;
        } else {
            console.log("=== Cycle Complete: No jobs found in this run. ===");
            return[];
        }
    }
}

module.exports = JobResearchAgent;
