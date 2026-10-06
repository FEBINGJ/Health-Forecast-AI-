# 🏥 Health Forecast AI — Clinical Risk Prediction System

> **AI-based early warning dashboard for patient deterioration and ICU readmission risk.**  
> A fully interactive UI/UX prototype built with React, TypeScript, and Tailwind CSS v4.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=for-the-badge)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss&logoColor=white&style=for-the-badge)

---

## 📋 Overview

**Health Forecast AI** is a clinical intelligence dashboard prototype designed to give healthcare teams early, actionable insight into patient deterioration and post-discharge readmission risk. It simulates a real-world AI-assisted clinical decision-support system (CDSS) with rich data visualisations, real-time alert management, and comprehensive patient records — all running 100% client-side with no backend required.

---

## ✨ Features

| Module | Description |
|---|---|
| 🔐 **Login** | Role-based authentication screen with department/role selection |
| 📊 **Dashboard** | Ward-level summary — risk distribution, active alerts, key metrics |
| 👥 **Patients** | Searchable, paginated patient roster with inline risk badges |
| 🔬 **Patient Detail** | Full vitals timeline, lab panels, clinical notes, and AI predictions |
| ➕ **Add Patient** | Multi-step admission form with vitals and lab entry |
| 🚨 **Alerts** | Prioritised alert feed with severity filtering and acknowledgement |
| ⚙️ **Settings** | Configurable risk thresholds, alert preferences, and user profile |

### 🤖 AI Risk Engines

- **Deterioration Score** — logistic-regression-style model using vitals trend, labs, and history
- **ICU Readmission Risk** — probability scoring with per-factor contributions
- **NEWS2 Score** — National Early Warning Score 2, auto-calculated from vitals
- **Clinical Alerts** — rule-based triggers for SpO₂, HR, BP, RR, temperature, and model scores

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript 5.9 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing | React Router DOM v7 (Hash Router) |
| Charts | Recharts v3 |
| Icons | Lucide React |
| Utilities | clsx, tailwind-merge |
| Output | Single-file build via `vite-plugin-singlefile` |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/FEBINGJ/health-forecast-ai.git
cd health-forecast-ai

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

### Production Build

```bash
npm run build
```

The build outputs a **single self-contained HTML file** in `dist/` (via `vite-plugin-singlefile`) — no server needed to deploy.

### Preview Build

```bash
npm run preview
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Layout.tsx          # App shell — sidebar, topbar, navigation
│   ├── PatientTable.tsx    # Sortable patient list with risk indicators
│   ├── PatientModals.tsx   # Confirm/delete modals
│   ├── ClinicalForms.tsx   # Reusable vitals & lab input forms
│   ├── Toast.tsx           # Toast notification system
│   ├── charts.tsx          # Recharts wrappers (vitals, risk trends)
│   └── ui.tsx              # Design system — buttons, cards, badges, inputs
├── pages/
│   ├── Login.tsx           # Auth screen
│   ├── Dashboard.tsx       # Ward overview
│   ├── Patients.tsx        # Patient roster
│   ├── PatientDetail.tsx   # Individual patient view
│   ├── AddPatient.tsx      # Admission form
│   ├── Alerts.tsx          # Alert management
│   └── Settings.tsx        # User & system settings
├── store/
│   └── AppStore.tsx        # Global state (Context API)
├── lib/                    # AI scoring utilities & data helpers
├── utils/                  # Formatting, date, and calculation helpers
├── types.ts                # Full TypeScript type definitions
└── index.css               # Global styles & Tailwind base
```

---

## 🗺️ Pages & Routes

| Route | Page |
|---|---|
| `/#/login` | Login |
| `/#/` | Dashboard |
| `/#/patients` | Patient List |
| `/#/patients/:id` | Patient Detail |
| `/#/add-patient` | Add Patient |
| `/#/alerts` | Alerts |
| `/#/settings` | Settings |

---

## 🎨 Design Highlights

- **Dark-mode-first** clinical aesthetic with blue accent palette
- **Glassmorphism** cards and sidebar with backdrop blur
- **Micro-animations** on risk score cards, alert badges, and form transitions
- **Responsive layout** — sidebar collapses on smaller screens
- **Inter** typeface (Google Fonts) for clinical readability
- Colour-coded risk levels: 🟢 Low · 🟡 Moderate · 🔴 High

---

## ⚠️ Disclaimer

This is a **UI/UX prototype only**. All patient data is synthetically generated and seeded locally. No real patient data is used, stored, or transmitted. The AI risk scores are simulated for demonstration purposes and are **not validated for clinical use**.

---

## 👤 Author

**FEBINGJ** · [febinop123@gmail.com](mailto:febinop123@gmail.com)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
