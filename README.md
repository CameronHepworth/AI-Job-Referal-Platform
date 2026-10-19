# AI Job Referral Platform

A full-stack web app that helps students land internships through warm referrals instead of cold applications.

> Status: in development

## Features
- **Lead discovery:** scrapes job and company data to find companies actively hiring
- **Hiring score:** ranks each lead with a scoring algorithm
- **Personalized outreach:** generates LinkedIn connection requests, cold emails, and follow-ups using the Claude API as well as the users parsed resume

## Tech stack
- Front end: React
- Back end: Node.js ([Express])
- AI: Claude API
- [Database, scraping libraries, etc.]

## Running locally
1. Clone the repo
2. Install back-end dependencies: `pip install -r requirements.txt`
3. Install front-end dependencies: `cd [frontend folder] && npm install`
4. Add your API key to a `.env` file: `ANTHROPIC_API_KEY=your_key_here`
5. Start the back end: `[command]`
6. Start the front end: `npm start`
