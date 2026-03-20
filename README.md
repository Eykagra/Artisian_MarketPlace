# Artisan Marketplace: Core Operations & Feature Documentation

The **Artisan Marketplace** is a specialized e-commerce platform designed to empower local artisans to display, manage, and sell their handmade crafts. This document provides an in-depth dive into **what the application does**, its core capabilities, and how different subsystems interact to create a seamless shopping and selling experience.

---

## 🏗 System Architecture & Domain Model

The platform is designed around several key entities that govern the marketplace:
- **Users**: Individuals who can act as either **Sellers** (artisans listing products) or **Buyers** (customers placing orders). 
- **Products**: The items listed for sale, which include rich metadata such as pricing, categorization, descriptions, and High-Resolution image links.
- **Orders**: The transactional records binding a buyer to a product, handling delivery information, and tracking payment and fulfillment statuses.
- **Chats & AI**: Real-time communication records, enhanced by AI assistance, allowing for seamless interactions.

---

##  Core Functionalities & Subsystems

### 1. Identity & Security (Auth Module)
The Marketplace securely handles user credentials using bcrypt hashing and secures all private API interactions via **JSON Web Tokens (JWT)**. 
- Artisans must authenticate to create or modify their listings.
- Buyers must authenticate to securely view their order history and initiate checkouts.

### 2. Digital Storefront (Product Catalog)
The heart of the system is the product catalog. Artisans can seamlessly perform CRUD (Create, Read, Update, Delete) operations on their handicrafts.
- **Media Management**: Instead of storing heavy images in the database, the system integrates with **Cloudinary**. When an artisan uploads an image, the backend streams it directly to the cloud, retrieves an optimized viewing URL, and ties it to the database record. 
- **Categorization**: Buyers can easily filter goods by broad categories (e.g., Jewelry, Pottery, Woodwork, Textiles).

### 3. Smart Cart & Inventory Protection (Reservation System)
To prevent "overselling" of unique items, the platform features an advanced **Reservation System**.
- **Cart Holds**: When a buyer adds a unique artisan item to their cart, the system creates a temporary "hold" on that specific piece of inventory.
- **Reservation Reaper Background Job**: To ensure products aren't blocked forever by abandoned carts, a background job (`reservationReaper.js`) continuously runs every 60 seconds on the server. It sweeps the database and automatically releases any expired product holds back to the public catalog.

### 4. Seamless Checkout (Orders & Stripe Module)
The application handles the entire lifecycle of a purchase securely.
- **Order Generation**: When a buyer decides to check out, an `Order` record is created in a 'pending' state, logging their specified delivery address, pincode, and contact details.
- **Stripe Integration**: The backend automatically communicates with the **Stripe API** to spawn a secure payment gateway session. Once the payment succeeds, the order status cascades, finalizing the purchase and transferring funds.

### 5. Intelligent Customer Interaction (AI Chat Module)
Rather than a standard messaging system, the platform features an intelligent chatbot powered by **NVIDIA NIM (Mistral-Large-3)**.
- **Contextual Assistance**: Buyers can ask questions about artisan products, policies, or general crafting advice. The chat module routes these queries to the high-performance AI model to generate human-like, helpful responses that assist users in making purchasing decisions without requiring artisans to be online 24/7.

---

## 🔧 Technical Flow

1. **Frontend Interaction**: The React/Vite front-end dynamically renders the artisan catalogs and cart states by querying the Express REST API. 
2. **Data Layer**: The backend routes all persistent requests to a strict **PostgreSQL** relational database. Strict Foreign Key constraints (e.g., `ON DELETE CASCADE`) ensure that if an artisan deletes their account, all their associated listings and unfulfilled orders are cleanly removed to prevent data corruption.
3. **Cloud Integrations**: Traffic to heavy media is offloaded to Cloudinary, complex payment validation logic is offloaded to Stripe, and natural language processing is offloaded to scalable NVIDIA NIM endpoints.

*This focused architecture cleanly separates concerns, ensuring a robust, scalable, and fully featured marketplace dedicated purely to the craftsmanship of local artisans.*
