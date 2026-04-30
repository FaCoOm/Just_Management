# **Scrum Breakdown & Sprint Plan**

## **1\. Product Backlog (Prioritized)**

### **High Priority (Must Have for MVP)**

* **STORY-01:** As a developer, I need an abstraction layer (Repository Pattern) in the React frontend so I can easily swap between Supabase and Node.js data fetching.  
* **STORY-02:** As an Admin, I need to authenticate into the dashboard securely.  
* **STORY-03:** As an Admin, I need a database schema that supports Properties, Rooms, Guests, and Reservations with strict foreign keys.  
* **STORY-04:** As the System, I need a webhook endpoint that accepts parsed JSON data from an n8n email workflow and saves it to the database.  
* **STORY-05:** As a Receptionist, I need to see a daily list of arrivals and departures on the main dashboard.

### **Medium Priority (Should Have)**

* **STORY-06:** As the System, I need to poll Airbnb iCal links daily and block out corresponding dates in the Rooms table.  
* **STORY-07:** As a Cleaner, I need to view rooms marked as "Dirty" and toggle them to "Clean".  
* **STORY-08:** As an Admin, I want to see a chart of monthly revenue and occupancy.

### **Low Priority (Could Have \- PicaOS Integrations)**

* **STORY-09:** As an Admin, I want bookings to automatically sync to Xero for accounting.  
* **STORY-10:** As a Guest, I want to receive an automated WhatsApp message (via WhatsApp Business API) on the day of check-in.

## **2\. Sprint Roadmap (2-Week Sprints)**

### **Sprint 1: Foundation & The "Great Split"**

**Goal:** Set up the shared frontend and both database environments. Define the data contracts.

* **Task 1 (Frontend):** Implement TanStack Query in the Vite app. Create an api/ folder with Interface definitions for data fetching.  
* **Task 2 (main branch):** Deploy Supabase project. Write and execute create\_portfolio\_schema.sql. Set up Row Level Security (RLS).  
* **Task 3 (sub-branch):** Provision Azure PostgreSQL Flexible Server. Initialize a Node.js/Express repository. Set up Prisma ORM and mirror the schema.  
* **Task 4 (Shared):** Build the Authentication UI. Wire Supabase Auth to main and Clerk/Auth0 to sub-branch.

### **Sprint 2: The Data Ingestion Pipeline**

**Goal:** Establish the ETL flow from external sources into the database.

* **Task 1 (Automation):** Spin up n8n instance. Create a workflow that connects to Gmail, filters for "Airbnb Confirmation", and extracts data.  
* **Task 2 (main branch):** Configure n8n to use the Supabase REST API node to insert bookings.  
* **Task 3 (sub-branch):** Build a POST /api/webhooks/bookings route in the Node.js server. Configure n8n to send HTTP requests to this route.  
* **Task 4 (Shared):** Implement idempotency (ON CONFLICT DO UPDATE) in both databases to handle duplicate email triggers.

### **Sprint 3: Core Dashboard UI**

**Goal:** Bring the data to life on the screen.

* **Task 1 (Frontend):** Build the ArrivalsDetail and DeparturesDetail components using data fetched via TanStack Query.  
* **Task 2 (Frontend):** Build the OccupancyChart using Recharts, mapping over historical reservation data.  
* **Task 3 (Backend/Both tracks):** Ensure the APIs correctly paginate and filter reservations by "today's date".  
* **Task 4 (Frontend):** Implement the Rooms management page (CRUD operations for physical rooms).

### **Sprint 4: Operations & Maintenance**

**Goal:** Support the ground staff.

* **Task 1 (Database/Both tracks):** Create Maintenance\_Tickets tables.  
* **Task 2 (Frontend):** Build the Maintenance page. Allow users to create a ticket, attach it to a Room, and change its status (Open, In Progress, Resolved).  
* **Task 3 (Frontend):** Create a mobile-responsive view of the Maintenance and Rooms pages for cleaning staff.  
* **Task 4 (QA):** Conduct end-to-end testing. Push a fake email through n8n and watch it appear on the React dashboard.