# ⏱️ Internship Hours Tracker (400-Hour DTR System)

A full-stack web application built to track, manage, and export internship Daily Time Record (DTR) hours toward a **400-hour internship requirement**. Featuring smart lunch-break deductions, live clock-in/clock-out, manual shift logging, email OTP verification, and one-click printable DTR PDF reports.

---

## 🚀 Live Deployment

- **Frontend (Vercel):** [https://internship-hour-tracker.vercel.app](https://internship-hour-tracker.vercel.app)
- **Backend API (Render Docker):** C# ASP.NET Core Web API (`.NET 10`)
- **Database:** MongoDB Atlas

---

## ✨ Key Features

- **📊 Visual Progress Dashboard:**
  - Circular progress ring displaying percentage completed and total rendered hours (`Completed / 400h`).
  - Automatic calculation of **Remaining Hours**, **Remaining Days** (based on 8 hours/day), and **Estimated Completion Date** (counting weekdays).
- **🕒 Smart Time Clock & Unpaid Lunch Handling:**
  - Choose between **Full Day (`AM + PM with automatic 1-hour unpaid lunch deduction`)**, **Half Day (`AM - Morning Only`)**, or **Half Day (`PM - Afternoon Only`)**.
  - Live **Morning Time In**, **Lunch Time Out**, **Back from Lunch (PM)**, and **End of Shift Time Out** controls.
  - Convenient **Manual Session Entry** with calendar date picker and auto-filled shift times.
- **📄 Official DTR PDF Report Export:**
  - One-click **Export PDF Report** generates a clean, printable **Internship Daily Time Record (DTR)** complete with intern full name, summary metrics, chronological session table, total rendered hours, and signature blocks for the intern and supervisor/coordinator.
- **🔐 Authentication & Account Security:**
  - **6-Digit Email OTP Verification** on registration and **Forgot/Reset Password** powered by **Brevo Transactional Email API**.
  - **JWT Bearer Authentication** & resource ownership verification.
  - **Fixed-Window Rate Limiting** (`10 requests/minute` per IP on auth and clock endpoints).
  - **In-Memory Caching (`IMemoryCache`)** for 5-minute user log caching with automatic cache invalidation on write operations.
- **🎨 Modern Responsive UI:**
  - Built with React 19 + Vite, featuring **Dark Mode / Light Mode** theme switching, expandable session accordions, and **10-per-page pagination**.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | C# ASP.NET Core Web API (`.NET 10`), `IMemoryCache`, ASP.NET RateLimiter, Custom HMAC-SHA256 JWT Handler |
| **Database** | MongoDB Atlas (`MongoDB.Driver` v3.13) |
| **Frontend** | React 19, Vite 6, CSS3 (Custom Dark/Light Theme) |
| **Email Service** | Brevo REST API (`/v3/smtp/email`) |
| **Deployment** | Render (Dockerized Backend) & Vercel (Static Frontend) |

---

## 📂 Project Structure

```text
InternshipHoursTracker/
├── Dockerfile                          # Multi-stage Docker build for Render deployment
├── render.yaml                         # Render Blueprint specification
├── InternshipHoursTracker/             # C# ASP.NET Core Backend API
│   ├── Controllers/
│   │   ├── UsersController.cs          # Auth, Register, Email OTP, Password Reset, Profile
│   │   └── TimeLogsController.cs       # Time-In/Out, Summary, Validation, CRUD
│   ├── Models/
│   │   ├── User.cs                     # User entity
│   │   ├── TimeLog.cs                  # TimeLog entity
│   │   ├── MongoDBSettings.cs          # Strongly-typed MongoDB configuration
│   │   └── BrevoSettings.cs            # Strongly-typed Brevo email configuration
│   ├── Services/
│   │   ├── MongoDbService.cs           # MongoDB driver + 5-min IMemoryCache service
│   │   ├── EmailService.cs             # Brevo transactional email client
│   │   └── JwtAuthHandler.cs           # JWT token generator & authentication handler
│   └── Program.cs                      # DI, Production CORS, Rate Limiting, OpenAPI/Swagger
└── frontend/                           # React + Vite Frontend
    ├── src/
    │   ├── App.jsx                     # Main application (Auth, Dashboard, Profile, Settings, PDF Export)
    │   ├── index.css                   # Responsive styling & Dark/Light mode themes
    │   └── main.jsx                    # React root entry
    ├── index.html
    └── vite.config.js
```

---

## ⚙️ Environment Variables

### Backend (Render / `appsettings.Development.json`)
| Variable | Description |
| :--- | :--- |
| `MongoDBSettings__ConnectionString` | MongoDB Atlas connection URI (`mongodb+srv://...`) |
| `BrevoSettings__ApiKey` | Brevo v3 API Key (`xkeysib-...`) |
| `BrevoSettings__SenderEmail` | Verified sender email address in Brevo |
| `BrevoSettings__SenderName` | Display name for outgoing emails (`Internship Hours Tracker`) |
| `JwtSettings__SecretKey` | Secret key (32+ chars) used to sign JWT tokens |

### Frontend (Vercel)
| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | Deployed Render backend API URL (e.g., `https://your-api.onrender.com/api`) |

---

## 💻 Running Locally

### 1. Start the C# Backend API
```powershell
cd InternshipHoursTracker
dotnet run
```
- The API will start at `http://localhost:5045` (with interactive Swagger UI available at the root URL `/`).

### 2. Start the React + Vite Frontend
```powershell
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.

