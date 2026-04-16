# ShotSphere — Photographer Marketplace

A full-stack marketplace platform that connects customers with professional photographers. Customers can browse, book, and review photographers. Photographers can manage their profiles, packages, availability, bookings, and deliveries. Admins oversee the entire platform.

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | https://shotsphere-001.web.app |
| Backend API | https://shotspherehub.onrender.com |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite | UI framework & build tool |
| Tailwind CSS v4 | Styling |
| React Router v7 | Client-side routing |
| Socket.IO Client | Real-time chat |
| Firebase SDK | Google Auth & Phone OTP |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | REST API server |
| MongoDB + Mongoose | Database & ODM |
| Socket.IO | Real-time messaging |
| JWT + HTTP-only Cookies | Authentication |
| Bcryptjs | Password hashing |
| Cloudinary | Image storage |
| Razorpay | Payment processing |
| Nodemailer | Email delivery |
| Twilio | SMS delivery |
| Firebase Admin | Phone verification |
| Web Push | Push notifications |

---

## Features

### Customers
- Browse and search photographers by location, event type, and price
- View photographer public profiles, portfolios, and reviews
- Book photographers with date and package selection
- Real-time chat with booked photographers
- Track delivery status of photo deliveries
- Leave reviews after delivery confirmation
- Wishlist favourite photographers
- Push notification support
- Google OAuth login

### Photographers
- Create and manage professional profile with portfolio images
- Set weekly availability and date-specific overrides
- Manage service packages with pricing
- Accept or decline booking requests
- Upload and manage photo deliveries
- View earnings and payout history
- Real-time chat with customers

### Admin
- Dashboard with platform metrics and system alerts
- Approve or reject photographer verification requests
- Manage users (block/unblock)
- Moderate reviews (approve, reject, flag)
- View and manage all bookings
- Process photographer payouts
- Analytics and reports

---

## Project Structure

```
photographer-services/
├── client/                         # React frontend
│   ├── public/
│   │   └── sw.js                   # Service worker for push notifications
│   └── src/
│       ├── _components/            # Shared UI components
│       ├── context/                # React context providers
│       ├── hooks/                  # Custom hooks
│       ├── i18n/                   # Translations (EN/multilingual)
│       ├── layouts/                # Role-based layouts (Guest, Customer, Photographer, Admin)
│       ├── pages/                  # Page components
│       ├── routes/                 # AppRoutes.jsx
│       ├── services/               # API service functions
│       └── utils/                  # Utility helpers
│
└── server/                         # Node.js backend
    ├── index.js                    # Entry point, Express + Socket.IO setup
    └── src/
        ├── config/                 # DB, Cloudinary config
        ├── controllers/            # Route handler logic
        ├── middleware/             # Auth, rate limiting, upload
        ├── models/                 # Mongoose schemas
        ├── routes/                 # Express routers
        ├── scripts/                # One-off maintenance scripts
        ├── services/               # Business logic services
        └── utils/                  # Utility helpers
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB Atlas account (or local MongoDB)
- Cloudinary account
- Razorpay account
- Firebase project (for Google Auth & Phone OTP)
- Twilio account (for SMS OTP)
- SMTP credentials (for email)

---

### 1. Clone the repository

```bash
git clone https://github.com/SM-SmileCode/photographer-marketplace.git
cd photographer-marketplace
```

---

### 2. Backend setup

```bash
cd server
npm install
```

Create a `.env` file in `server/`:

```env
PORT=4000
NODE_ENV=development

MONGO_URI=<your_mongodb_connection_string>

JWT_SECRET=<your_jwt_secret>

CLIENT_URL=http://localhost:5173
CLIENT_URL_DEV=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

# Email (Nodemailer)
SMTP_HOST=<your_smtp_host>
SMTP_PORT=587
SMTP_USER=<your_smtp_user>
SMTP_PASS=<your_smtp_password>
EMAIL_FROM=<your_from_email>

# Twilio (SMS OTP)
TWILIO_ACCOUNT_SID=<your_account_sid>
TWILIO_AUTH_TOKEN=<your_auth_token>
TWILIO_PHONE_NUMBER=<your_twilio_number>

# Firebase Admin (Phone verification)
FIREBASE_PROJECT_ID=<your_project_id>
FIREBASE_CLIENT_EMAIL=<your_client_email>
FIREBASE_PRIVATE_KEY=<your_private_key>

# Razorpay
RAZORPAY_KEY_ID=<your_key_id>
RAZORPAY_KEY_SECRET=<your_key_secret>

# Web Push
VAPID_PUBLIC_KEY=<your_vapid_public_key>
VAPID_PRIVATE_KEY=<your_vapid_private_key>
VAPID_MAILTO=mailto:<your_email>
```

Start the server:

```bash
# Development
npm run dev

# Production
npm start
```

---

### 3. Frontend setup

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```env
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=<your_firebase_api_key>
VITE_FIREBASE_AUTH_DOMAIN=<your_auth_domain>
VITE_FIREBASE_PROJECT_ID=<your_project_id>
VITE_FIREBASE_APP_ID=<your_app_id>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
VITE_VAPID_PUBLIC_KEY=<your_vapid_public_key>
```

Start the frontend:

```bash
# Development
npm run dev

# Production build
npm run build
```

---

## API Overview

### Auth & Users
| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Register new user |
| POST | `/login` | Login with email & password |
| POST | `/logout` | Logout |
| GET | `/me` | Get current user |
| POST | `/auth/google` | Google OAuth login |
| POST | `/forgot-password` | Request password reset email |
| POST | `/reset-password` | Reset password with token |
| POST | `/verification/contact/request` | Request OTP (email/phone) |
| POST | `/verification/contact/confirm` | Confirm OTP |
| PATCH | `/me/profile` | Update profile name |
| PATCH | `/me/email` | Update email (with OTP) |
| PATCH | `/me/phone` | Update phone (with OTP) |
| PATCH | `/me/profile-image` | Update profile image URL |

### Photographers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/photographers` | Browse all photographers |
| GET | `/photographers/:slug` | Public profile by slug |
| POST | `/photographer-profile` | Create photographer profile |
| PATCH | `/photographer-profile/me` | Update own profile |
| GET | `/photographer/availability/me` | Get own availability |
| PUT | `/photographer/availability/me` | Set weekly availability |
| POST | `/photographer/packages` | Create package |
| PATCH | `/photographer/packages/:id` | Update package |
| DELETE | `/photographer/packages/:id` | Delete package |

### Bookings & Deliveries
| Method | Endpoint | Description |
|---|---|---|
| POST | `/bookings` | Create booking |
| GET | `/bookings/me` | Customer's bookings |
| GET | `/photographer/bookings` | Photographer's bookings |
| PATCH | `/photographer/bookings/:id/respond` | Accept or decline booking |
| PATCH | `/bookings/:id/cancel` | Cancel booking |
| PATCH | `/bookings/:id/complete` | Mark booking complete |
| GET | `/deliveries/me` | Customer's deliveries |
| PATCH | `/photographer/deliveries/:id` | Update delivery |
| PATCH | `/deliveries/me/:id/confirm` | Customer confirms delivery |
| PUT | `/deliveries/me/:id/review` | Submit delivery review |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/dashboard/metrics` | Dashboard stats |
| GET | `/admin/reviews` | Reviews for moderation |
| PATCH | `/admin/reviews/:id/moderate` | Approve/reject review |
| GET | `/admin/photographer-requests` | Pending verifications |
| GET | `/admin/users` | All users |
| GET | `/admin/bookings` | All bookings |

---

## Deployment

### Backend — Render
1. Connect your GitHub repo to [Render](https://render.com)
2. Set **Root Directory** to `server`
3. Set **Build Command** to `npm install`
4. Set **Start Command** to `npm start`
5. Add all environment variables from the `.env` section above

### Frontend — Firebase Hosting
```bash
cd client
npm run build
firebase deploy
```

---

## Scripts

```bash
# Backfill review stats for all photographer profiles
cd server && npm run backfill:review-stats

# Run tests
cd server && npm test
```

---

## License

ISC
