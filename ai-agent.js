
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class JobResearchAgent {
    constructor() {
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        this.SEARCH_API_KEY = process.env.SEARCH_API_KEY;
        this.SEARCH_CX = process.env.SEARCH_CX;
        this.GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL;

        this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    }

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

        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        const randomRole = roles[Math.floor(Math.random() * roles.length)];
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];

        return `${jobKeywords} ${randomCompany} ${randomRole} ${randomLocation}`;
    }

    async executeSearch(query) {
        console.log(`[Agent] Executing Search Query: ${query}`);
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${this.SEARCH_API_KEY}&cx=${this.SEARCH_CX}&q=${encodeURIComponent(query)}&num=10`;

        try {
            const response = await axios.get(searchUrl);
            return response.data.items || [];
        } catch (error) {
            console.error(`[Agent Error] Search Failed:`, error.message);
            return [];
        }
    }

    async analyzeAndExtract(searchResults) {
        if (searchResults.length === 0) return [];

        const searchContext = searchResults.map(item =>
            `Title: ${item.title}\nURL: ${item.link}\nSnippet: ${item.snippet}`
        ).join('\n\n---\n\n');

        const prompt = `
You are an Advanced AI Job Intelligence Agent. Analyze the following Google Search results and extract valid job postings.
Only extract real jobs located in Saudi Arabia, Oman, or Qatar.

Return STRICTLY a JSON array of objects with these keys:
- title
- company
- country
- city
- applyLink
- hrEmail
- visaSponsorship
- skills

Search Results:
${searchContext}
`;

        try {
            const result = await this.model.generateContent(prompt);
            let responseText = result.response.text();
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(responseText);
        } catch (error) {
            console.error("Gemini extraction failed", error.message);
            return [];
        }
    }

    async saveToDatabase(jobList) {
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
                console.error("Failed saving job", job.title);
            }
        }
        return savedCount;
    }

    async generateCoverLetter(jobTitle, companyName, skills) {
        const prompt = `Write a professional cover letter for ${jobTitle} at ${companyName}. Skills: ${skills}`;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch {
            return "Error generating cover letter.";
        }
    }

    async runFullCycle() {
        console.log("=== AI Job Agent Started ===");
        const query = this.generateBooleanQuery();
        const results = await this.executeSearch(query);

        if (results.length > 0) {
            const extractedJobs = await this.analyzeAndExtract(results);
            const savedCount = await this.saveToDatabase(extractedJobs);
            console.log(`Cycle Complete: ${savedCount} saved`);
            return extractedJobs;
        }

        return [];
    }
}

module.exports = JobResearchAgent;
