# System Architecture & Data Flow Design

This document outlines the technical blueprint and data movement within the **ShotSphere** platform, illustrating how various components interact to deliver a seamless photography marketplace experience.

---

## 1. System Architecture Diagram

The ShotSphere architecture is built on the **MERN** stack, augmented by industry-leading third-party services for media, payments, and notifications.

```mermaid
graph TD
    subgraph "Client Side (Frontend)"
        A[React SPA / Vite]
        B[Tailwind CSS]
        C[Socket.io Client]
    end

    subgraph "Server Side (Backend)"
        D[Node.js / Express API]
        E[Socket.io Server]
        F[Middleware: Auth, Multer, etc.]
    end

    subgraph "Storage & Database"
        G[(MongoDB / Mongoose)]
        H[Cloudinary: Media Storage]
    end

    subgraph "External Integrations"
        I[Firebase Admin: Auth & Push]
        J[Razorpay: Payments]
        K[Twilio: SMS Notifications]
        L[Nodemailer: Email Engine]
    end

    %% Relationships
    A <-->|REST / HTTPS| D
    A <-->|WebSockets| E
    D --> F
    F --> G
    D --> I
    D --> J
    D --> K
    D --> L
    D <--> H
```

### Component Breakdown
*   **React & Vite:** A high-performance frontend for a snappy, app-like feel.
*   **Express API:** A modular backend handling business logic and routing.
*   **MongoDB:** A flexible NoSQL database storing users, portfolios, and booking data.
*   **Cloudinary:** Handles heavy lifting for high-resolution photography uploads and transformations.
*   **Razorpay:** Manages the secure financial flow from client to photographer.
*   **Firebase:** Provides secure user authentication and handles background push notifications.

---

## 2. Data Flow Diagram (DFD) - Level 1

The following diagram illustrates the primary data paths between users and the system processes.

```mermaid
flowchart LR
    %% Entities
    U[Client / Customer]
    P[Photographer]
    A[Admin]

    %% Processes
    subgraph "ShotSphere Core System"
        P1(User & Profile Management)
        P2(Search & Discovery)
        P3(Booking & Scheduling)
        P4(Payment & Payout Engine)
        P5(Messaging & Notification)
        P6(Delivery & Feedback)
    end

    %% Data Stores
    D1[(User/Profile DB)]
    D2[(Bookings/AVAIL DB)]
    D3[(Transactions DB)]
    D4[(Messages DB)]

    %% Connections
    U -->|Registration Info| P1
    P -->|Portfolio & Packages| P1
    P1 <--> D1

    U -->|Search Queries| P2
    P2 <--> D1

    U -->|Booking Requests| P3
    P -->|Availability & Response| P3
    P3 <--> D2

    U -->|Payment Data| P4
    P4 -->|Payout Status| P
    P4 <--> D3

    U <-->|Chat & Alerts| P5
    P <-->|Chat & Alerts| P5
    P5 <--> D4

    P -->|Digital Delivery| P6
    P6 -->|Feedback & Confirmation| U
    P6 -->|Status Update| D2
```

### Primary Data Paths
1.  **Engagement Loop:** Clients query **Process P2** (Discovery) to find photographers. Data is pulled from **D1** (Profiles).
2.  **Booking Loop:** Clients submit requests to **Process P3**. The system checks **D2** (Availability) and triggers **Process P5** (Notifications) to the photographer.
3.  **Financial Loop:** When a booking is accepted, **Process P4** interacts with Razorpay and updates **D3** (Transactions).
4.  **Delivery Loop:** Photographers upload assets via **Process P6**, which notifies the client and updates the booking status in **D2**.

---

## 3. Technology Stack Summary

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Tailwind CSS 4 | Responsive UI and Performance |
| **Backend** | Express 5 + Node.js | Robust API and Business Logic |
| **Database** | MongoDB 7 + Mongoose | Data Persistence |
| **Real-time** | Socket.io 4 | Instant Messaging and Alerts |
| **Media** | Cloudinary | Photo Uploads and Image Optimization |
| **Security** | JWT + Firebase Admin | Authentication and Authorization |
| **Finance** | Razorpay | Payments and Payouts |
| **Communication** | Twilio + Web-push | SMS and Desktop Notifications |
