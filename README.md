# EventVibe — Smart Event Feedback Collector & Analytics Dashboard

> **Full Stack Challenge 07 Solution**: Designed for high-impact classroom presentation and production-grade event feedback processing.

---

## 🌟 Overview & Problem Statement
Feedback forms often collect hundreds of comments that event organizers lack the time to read manually. As a result, critical organizational issues (like broken AV equipment, bad food, or timing delays) recur across events.

**EventVibe** solves this problem by connecting attendee submissions directly to an AI-mediated backend pipeline. The backend automatically extracts:
1. **Sentiment Label**: `positive`, `neutral`, `negative` (or `Not analysed` on fallback).
2. **Topic Tag**: `food`, `timing`, `content`, `venue`, `speakers`, `organization`, `other`.
3. **Rating Mismatch Alert**: Detects conflicts (e.g. 5 stars given with negative text).

All responses flow into a real-time **Organizer Dashboard** featuring interactive Chart.js visualizations, topic distributions, sentiment filters, and executive summary generation.

---

## ⚡ Key Features

### Core Requirements
- 🌟 **Attendee Feedback Form**: 1–5 star rating selector with character-counted comment box.
- 🤖 **Backend-Mediated AI Pipeline**: Server receives submission, calls Gemini AI API securely, validates output against allowed values (`positive`, `neutral`, `negative` and allowed topics).
- 🛡️ **Graceful Degradation**: If the AI API is unavailable (or missing `GEMINI_API_KEY`), the comment is still saved to SQLite database and flagged cleanly as `"Not analysed"`.
- 📊 **Organizer Analytics Dashboard**:
  - Live feedback listing with sentiment and topic badges.
  - Aggregated counts per sentiment & topic tag.
  - Average rating and response metrics.
  - Filterable by sentiment, topic, rating mismatch, and search query.
- 🔒 **Server-Side Secret Isolation**: API keys remain strictly in backend environment variables (`.env`) or passed via secure server endpoints—never exposed to browser client code.

### Bonus Extensions Implemented
- 🎨 **Dynamic Background & Theme Customizer**: Interactive theme switcher with 7 aesthetic presets (Midnight Slate, Cosmic Nebula, Deep Ocean, Cyberpunk Neon, Emerald Matrix, Sunset Glow, and Executive Light), custom solid & gradient pickers, custom wallpaper image URLs, and floating animated ambient glow effects—persisted automatically in `localStorage`.
- 🧠 **Executive AI Summary Generator**: Analyzes recent feedback comments to generate an executive overview, top praises, critical pain points, and actionable event recommendations.
- ⚠️ **Rating vs. Sentiment Mismatch Alert**: Automatically flags conflicting submissions (e.g., 5-star rating with negative text or 1-star rating with positive text).
- 📥 **CSV Export**: One-click export of all feedback records to `feedback_export.csv`.
- 🔄 **Re-analyze Engine**: Allows organizers to retroactively trigger AI analysis on "Not analysed" entries once API key is connected.
- 🎲 **One-Click Demo Data Seed**: Populates 15 realistic event feedback submissions instantly for presentation demo.

---

## 🛠️ Architecture & Tech Stack

```
                       ┌─────────────────────────┐
                       │   Browser Frontend      │
                       │ (HTML5, Tailwind, JS)   │
                       └───────────┬─────────────┘
                                   │
                         HTTP POST /api/feedback
                                   │
                       ┌───────────▼─────────────┐
                       │   Backend Web Server    │
                       │   (Node 24 / HTTP)      │
                       └─────┬──────────────┬────┘
                             │              │
       Gemini API Request    │              │ SQLite Read/Write
   (Hidden Server Secrets)   │              │
┌────────────────────────────▼┐   ┌─────────▼───────────────┐
│     Google Gemini API       │   │   SQLite Database       │
│  (Sentiment & Topic Model)  │   │  (node:sqlite Engine)   │
└─────────────────────────────┘   └─────────────────────────┘
```

- **Backend**: Node 24 with native `node:http` and native `node:sqlite`.
- **Frontend**: Responsive Tailwind CSS, Chart.js graphs, SVG star ratings, glassmorphic UI cards.
- **Database**: SQLite database stored in `feedback.db`.

---

## 🚀 Quick Start & How to Run

### 1. Prerequisites
- Node.js installed (v18+ or v24).

### 2. Set Environment Variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Gemini API Key in `.env`:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Note: If no API key is provided, the system gracefully falls back to saving responses as "Not analysed" without crashing).*

### 3. Start the Server
```bash
node server.js
```
Open your browser at: **`http://localhost:3000`**

---

## 🏫 Classroom Presentation Walkthrough

When presenting this project in class:

1. **Demonstrate Graceful Fallback**:
   - Submit a review without an API key configured. Show that the backend successfully saves the record as `"Not analysed"`, preventing user error messages.
2. **Demonstrate Live AI Tagging**:
   - Open the **Presentation Settings Modal** (gear icon in header) and enter your Gemini API key (or set `GEMINI_API_KEY` in environment).
   - Submit a review like: *"The speakers were amazing, but lunch ran out of food!"*
   - Show how the AI automatically labels sentiment as `positive` or `neutral` and tags topic as `food` or `speakers`.
3. **Demonstrate Mismatch Detection**:
   - Submit 5 stars with comment: *"Terrible venue, too cold and noisy!"*
   - Show the yellow **Mismatch Alert** badge popping up in the dashboard.
4. **Demonstrate Organizer Dashboard**:
   - Click **"Seed Demo Data"** to instantly load 15 realistic reviews.
   - Interact with the **Sentiment Distribution Chart** and **Topic Tag Bar Chart**.
   - Filter by Topic (`food`, `venue`, `speakers`).
   - Click **"Generate AI Summary"** to show the executive takeaways panel!
   - Click **"Export CSV"** to download the spreadsheet report.

---

## 🔒 Security Explanation: Why Secrets Stay on the Server
- **Client Risk**: If API keys are embedded in frontend HTML/JS, any user can inspect source code or network traffic and steal the key.
- **Backend Mediation**: By routing all requests through our Node.js backend (`/api/feedback`), the client only sends user content. The server verifies inputs, attaches secret API credentials, validates the AI output against strict enum schemas, and returns clean results.

---

## 📄 License
MIT License — Created for Full Stack Challenge 07.
