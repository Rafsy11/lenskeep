# 👁️ LensKeep

> **Visual Memory Reimagined.**
> An advanced OCR and AI Visual Analysis Engine designed to capture, organize, and extract context from your daily screenshots and images seamlessly.

---

## ✨ Core Features

* **🧠 Multimodal AI Engine:** Powered by Google Gemini to not only extract raw OCR text but to understand the contextual meaning of the image (e.g., categorizing receipts, code snippets, or notes).
* **⚡ Smart Capture & Compression:** Client-side image compression guarantees rapid uploads and zero memory leaks without sacrificing AI analysis quality.
* **🔐 Passwordless Authentication:** Secure, frictionless login flow using magic OTP links delivered natively via **Resend** and custom domain integration.
* **🔍 Instant Neural Search:** Find any image in milliseconds by searching for the text contained within it, even if the image isn't manually tagged.
* **📱 Responsive & Fluid UI:** Fully optimized mobile experience with tactile 44px touch targets, dynamic hamburger menus, and iOS-safe viewports.
* **🌙 Premium Dark Theme:** Aesthetic Tailwind-powered dark mode with custom scrollbars and perceptual skeleton loaders.

## 🛠️ Tech Stack & Architecture

* **Frontend:** Next.js 14, React, Tailwind CSS
* **Backend / APIs:** Next.js API Routes (Serverless)
* **Database & Auth:** Firebase Firestore, Firebase Auth
* **AI Engine:** Google Gemini Pro Vision API
* **Email Infrastructure:** Resend SDK + React Email
* **Deployment:** Dockerized for Google Cloud Run (GCP)

---

## 🚀 Local Development Setup

To run LensKeep locally, follow these steps:

### 1. Clone the repository
```bash
git clone [https://github.com/YOUR_USERNAME/lenskeep.git](https://github.com/YOUR_USERNAME/lenskeep.git)
cd lenskeep

```

### 2. Install dependencies

```bash
npm install

```

### 3. Environment Variables

Create a `.env.local` file in the root directory. **Never commit this file.**

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI & Email Infrastructure
GEMINI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key

```

### 4. Start the Development Server

```bash
npm run dev

```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result.

---

## ☁️ Deployment (Google Cloud Run)

LensKeep is architected to run as a serverless container on GCP.
The project includes a standalone `next.config` and a highly optimized `Dockerfile`.

```bash
# Build and Deploy via Google Cloud CLI
gcloud run deploy lenskeep --source . --region ap-northeast-1 --allow-unauthenticated

```

---

*Built with precision and standard engineering practices.*

```
