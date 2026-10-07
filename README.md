<div align="center">

# 👥 StaffFlow
### Employee Management & HR System

**Attendance · Leaves · Evaluations · Monthly Ranking · Reports — with security enforced inside the database.**

![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_RLS-4169E1?logo=postgresql&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)

</div>

---

## 📌 Overview

StaffFlow is a production-grade HR web application for multi-department companies. It covers the full employee lifecycle — from onboarding and daily attendance to performance evaluations and an automatic monthly ranking — in **Arabic (RTL) and English (LTR)**.

The key design decision: **security lives in PostgreSQL, not in the UI.** Every table is protected by Row Level Security policies and a role + permission engine, so a user can never read or change data just by calling the API directly.

## ✨ Features

| Module | What it does |
|---|---|
| 🧑‍💼 **Employees & Org** | Employees, departments, teams, managers, management-scope resolution |
| 🕒 **Attendance** | Daily register, calendar view, absences, leave types & leave requests, holidays |
| ⭐ **Evaluations** | Dynamic criteria, stage weights, evaluation templates |
| 🏆 **Monthly Ranking** | Automatic ranking + "Employee of the Month" badge |
| 📊 **Reports** | Filterable reports with **PDF & Excel export** (Arabic-ready fonts) |
| 🔐 **Roles & Permissions** | 4 roles (Admin, HR, Manager, Employee) × 40 granular permissions |
| 🎨 **Customization** | 6 themes + light/dark/system, profile frames, badges, name colours |
| 🔔 **Notifications & Audit Log** | Database-triggered notifications and a full audit trail |

## 🏗️ Architecture

```mermaid
flowchart LR
  U[Browser<br/>React + TS + Tailwind] -->|supabase-js| A[Supabase Auth]
  U -->|REST / RPC| DB[(PostgreSQL)]
  DB --> RLS[Row Level Security<br/>on every table]
  DB --> FN[Permission engine<br/>triggers & functions]
  U --> X[PDF / Excel export<br/>jsPDF · ExcelJS]
  CF[Cloudflare Pages] -. hosts .-> U
```

- **9 ordered SQL migrations** — schema, functions/triggers, RLS policies, seed data, one-time admin bootstrap
- **Layered front end** — `features/`, `services/`, `hooks/`, `providers/`, `i18n/`
- **React Query** for server state, **Recharts** for dashboards
- **No public sign-up** — users are created by an admin from inside the app

## 🚀 Getting Started

```bash
npm install
cp .env.example .env      # add your Supabase URL + anon key
npm run dev               # http://localhost:5173
```

Full step-by-step setup (Supabase migrations, first admin, Cloudflare deploy): **[docs/SETUP.md](docs/SETUP.md)**
Security test checklist: **[docs/SECURITY-TESTS.md](docs/SECURITY-TESTS.md)**

## 🗂️ Project Structure

```
supabase/migrations/   9 SQL migrations (schema → RLS → seed → bootstrap)
src/features/          feature modules (employees, attendance, evaluations, reports…)
src/services/          data-access layer over Supabase
src/lib/pdf/           PDF generation with Arabic font support
src/i18n/              Arabic / English translations
```

## 🛣️ Roadmap

Payroll & salaries · bonuses & loans · employee requests · tasks & KPIs · recruitment · contracts · email/WhatsApp notifications · mobile app

---

## 👤 Author

**Mahmoud Shahab** — AI Department Manager · AI Automation & Operations
Building AI-powered systems that turn messy operations into clear, trackable workflows.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-mahmoud--shahab--ai-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mahmoud-shahab-ai)
[![GitHub](https://img.shields.io/badge/GitHub-ShekoDev-181717?logo=github)](https://github.com/ShekoDev)

© Mahmoud Shahab — All rights reserved.
