# **Product Requirements Document (PRD): Property Management System (PMS)**

## **1\. Project Overview & Purpose**

**Product Name:** Facoom Management Dashboard

**Objective:** To build a centralized, automated Property Management System tailored for hospitality businesses. The system will aggregate booking data, manage guest communications, and oversee maintenance operations without relying on official OTA (Online Travel Agency) APIs.

**Strategic Goal:** Achieve high operational visibility and eliminate double-bookings through an automated ETL (Extract, Transform, Load) pipeline using iCal and email parsing.

## **2\. Dual-Architecture Deployment Strategy**

This project follows a unique A/B architectural deployment to test development velocity (BaaS) versus enterprise control (PaaS).

### **Track A: The main branch (Supabase / BaaS)**

* **Frontend:** React, Vite, Tailwind CSS, TanStack Query.  
* **Backend/API:** PostgREST (Auto-generated REST API by Supabase).  
* **Database:** Supabase PostgreSQL.  
* **Auth:** Supabase GoTrue.  
* **Real-time:** Supabase Realtime (native PostgreSQL logical replication to WebSockets).  
* **Focus:** Extreme time-to-market, real-time WebSocket capabilities, thick-client architecture utilizing Row Level Security (RLS).

### **Track B: The sub-branch (Azure Custom / PaaS)**

This track represents a fully decoupled, custom-built backend replacing all out-of-the-box Supabase services with dedicated enterprise-grade technologies.

* **Frontend:** React, Vite, Tailwind CSS, TanStack Query (Shared UI).  
  * *Integration Logic:* Implements the **Repository Pattern** utilizing Axios/Fetch to decouple the UI from the data source, allowing seamless switching between Tracks A and B.  
* **Backend / API Layer (The PostgREST Replacement):**  
  * *Primary Setup:* **Node.js (Express.js or NestJS)** to handle complex, custom business logic, data sanitization, and external webhooks.  
  * *Secondary Setup (Optional):* Self-hosted **PostgREST** on Azure App Service to replicate Supabase's instant CRUD API generation directly over the PostgreSQL schema.  
* **Database & ORM (The Supabase DB Replacement):**  
  * *Database Hosting:* **Azure Database for PostgreSQL \- Flexible Server**.  
  * *ORM & Migrations:* **Prisma ORM** (or Drizzle) for strict TypeScript database access, schema modeling, and robust database migration management (replacing the Supabase CLI).  
* **Authentication & Security (The GoTrue & RLS Replacement):**  
  * *Identity Provider:* **Clerk** or **Auth0** (leveraged from PicaOS integrations) for JWT-based user session management.  
  * *Authorization:* Node.js middleware to verify JWTs and enforce Role-Based Access Control (RBAC) at the endpoint/controller level, effectively replacing PostgreSQL Row Level Security (RLS).  
* **Real-time Engine (The Supabase Realtime Replacement):**  
  * *WebSockets:* **Socket.io** hosted on Node.js, or **Azure Web PubSub**, to broadcast real-time database changes (e.g., new automated bookings) to the React dashboard.  
* **Focus:** Enterprise compliance, complex custom business logic, absolute data ownership, cloud provider consolidation, and lack of vendor lock-in.

## **3\. Target Audience & Personas**

1. **The Property Manager (Admin):** Needs high-level overviews of revenue, occupancy, and branch comparisons.  
2. **The Receptionist (Operations):** Needs real-time views of daily arrivals/departures and the ability to manually override/update guest statuses.  
3. **The Cleaning/Maintenance Staff:** Needs mobile-friendly views of rooms requiring turnover or repair tickets.

## **4\. Core Features & Epics**

### **Epic 1: Automated Data Ingestion (The "Shadow Sync")**

* **iCal Polling:** System must fetch standard .ics files from Airbnb/Booking.com every 15 minutes to lock calendar dates.  
* **Email/CSV Parsing:** Utilizing **n8n** or **Make** to catch confirmation emails, extract financial/guest data, and push to the database via webhook.  
* **Idempotency:** The database must use Upsert logic (Update if exists, Insert if new) based on Reservation ID to prevent duplicate entries.

### **Epic 2: Real-Time Dashboard (Shared Frontend)**

* **KPI Summary:** Total revenue, current occupancy rate, and pending maintenance.  
* **Arrivals/Departures:** A live-updating list of check-ins and check-outs for the current day.  
* **Calendar View:** A visual timeline of room bookings across all branches.

### **Epic 3: Entity Management**

* **Rooms & Properties:** CRUD operations for physical assets, including status (Clean, Dirty, Maintenance).  
* **Guests:** A lightweight CRM to track guest history, contact info, and special requests.  
* **Maintenance Ticketing:** Ability to create, assign, and resolve issue tickets attached to specific rooms.

## **5\. Non-Functional Requirements**

* **Performance:** The dashboard must load within 1.5 seconds.  
* **Scalability:** The architecture must handle at least 50 concurrent internal users and process up to 1,000 automated webhook ingestions per day.  
* **Security:** Role-Based Access Control (RBAC) ensures that maintenance staff cannot view financial revenue data.

## **6\. Out of Scope (For V1)**

* Direct payment processing (Stripe/Adyen integration deferred to V2).  
* Automated outgoing SMS/WhatsApp messaging to guests (Deferred to V2).  
* Dynamic pricing algorithms.