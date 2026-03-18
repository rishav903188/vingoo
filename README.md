# 🚀 Vingo - Food Ordering & Real-Time Chat Platform

## 📌 Overview

Vingo is a full-stack food ordering and delivery platform built using the MERN stack. It includes real-time chat, order tracking, and role-based dashboards for users, shop owners, and delivery partners.

---

## 🛠️ Tech Stack

### Frontend:

* React.js
* Redux Toolkit
* Tailwind CSS

### Backend:

* Node.js
* Express.js
* MongoDB

### Other Integrations:

* Socket.io (Real-time chat)
* Cloudinary (Image upload)
* Razorpay (Payments)
* Firebase (Optional services)

---

## ✨ Features

### 👤 User Features:

* Browse food items by city
* Add to cart & place orders
* Real-time order tracking
* Live chat with delivery/owner

### 🏪 Shop Owner:

* Create & manage shop
* Add/edit/delete items
* View incoming orders

### 🚴 Delivery Partner:

* Get assigned deliveries
* OTP-based delivery verification
* Track delivery status

---

## 🔐 Authentication

* JWT-based authentication
* Role-based access (User / Owner / Delivery)

---

## ⚡ Real-Time Features

* Live chat using Socket.io
* Order status updates
* Delivery tracking

---

## 📂 Project Structure

```
Vingo/
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middlewares/
│   └── utils/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── redux/
│   └── hooks/
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```
git clone https://github.com/your-username/Vingo.git
cd Vingo
```

### 2️⃣ Install dependencies

```
cd backend
npm install

cd ../frontend
npm install
```

### 3️⃣ Setup environment variables

Create `.env` file in backend:

```
PORT=8000
MONGODB_URL=your_mongodb_uri
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

### 4️⃣ Run the project

Backend:

```
npm run dev
```

Frontend:

```
npm start
```

---

## 📸 Screenshots

(Add screenshots here)

---

## 🌐 Live Demo

(Add deployed link here)

---

## 🚧 Future Improvements

* Push notifications
* Better UI/UX
* Admin dashboard
* Payment history

---

## 👨‍💻 Author

Rishav Kumar

---


