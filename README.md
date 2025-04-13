Local Food Bank Assistance App

A web app that connects people needing food with those who want to donate. It was built with React and Flask for my programming project.

What It Does:

This app helps three types of users:

1.	Recipients: People who need food can request specific items
2.	Donors: People who want to help can see and claim requests
3.	Admins: Can approve requests and manage users

 Main Features:

- Register and login with first/last name and password
- Password verification (requires 8+ characters, uppercase letter, and number)
- Request food items (meats, vegetables, fruits, grains)
- Claim requests if you're a donor
- Admin dashboard for Sami to manage everything
- VIP membership option (mock payment for now)
- Notifications when things happen
- Error handling for form submissions and API calls

 Tech that I Used:

Frontend-
- React (using Vite because it's faster than Create React App)
- Basic CSS (nothing fancy, just functional)
- Running on Heroku with the backend

Backend-
- Flask API
- SQLite database (simple but works for this project)
- CORS for frontend-backend communication

 Setting Up Locally:

Backend
1. Create a virtual environment: `python -m venv .venv`
2. Activate it (Windows: `.venv\Scripts\activate`, Mac/Linux: `source .venv/bin/activate`)
3. Install dependencies: `pip install -r requirements.txt`
4. Run the server: `python app.py`

Frontend
1. Install dependencies: `npm install`
2. Create a `.env` file with: `VITE_API_URL=http://localhost:5000`
3. Start the dev server: `npm run dev`

Deployment:

I deployed the whole app to Heroku at https://local-food-bank-assistance-app-b7fdf02e1063.herokuapp.com/.

I also deployed the frontend separately to Netlify at https://lucky-lamington-1db512.netlify.app/. I had some login issues at first but figured it out. The tricky part was making sure the frontend on Netlify could talk to the backend on Heroku properly, especially with CORS and cookies.

API Endpoints

The main endpoints my app uses:

- Auth: `/api/register`, `/api/login`, `/api/logout`
- Recipients: `/api/request-food`, `/api/my-requests`
- Donors: `/api/requests`, `/api/claim-request/{id}`
- Admin: `/api/admin/users`, `/api/admin/requests`
- VIP: `/api/upgrade-to-vip`
- Notifications: `/api/notifications`

My Database Models

The app has 4 main database tables:

1.	User: Basic user info plus role (recipient/donor/admin)
2.	Request: Food requests with status (pending/approved/claimed)
3.	FoodItem: Individual food items in a request
4.	Notification: System notifications for users



Version Control

I've created a GitHub repository for this project at https://github.com/ranarlilley/Local-Food-Bank-Assistance-Application where all the code, documentation, and setup instructions are available. The repository includes both the frontend React code and the backend Flask API.

I was unsure about using version control at the beginning of the project, but as I continued working, I learned why it's important for tracking changes and collaborating. Creating the repository has been really helpful for managing the project as it grew more complex.

The Problems I Ran Into

1.	Had some trouble getting the request claiming to update properly for donors
2.	The notifications system was tricky to implement but works now
3.	Getting CORS to work correctly between frontend and backend was annoying
4.	Session cookies needed special configuration to work in production
5.	Implementing good password validation took some work - I made it require 8+ characters, an uppercase letter, and a number for security
6.	Error handling was important to get right - I added specific error messages for things like invalid login, missing fields, and server errors

 Things I'd Add With More Time

1.	Email notifications (right now everything is in-app)
2.	More food categories with pictures
3.	Password reset (in case users forget)
4.	Better mobile styling
5.	Ability to cancel requests
6.	Delivery tracking would be cool


Notes for My Professor

This project helped me learn a lot about connecting frontend and backend. The Flask API was challenging at first, but I got more comfortable with it over time. React hooks like useState and useEffect were really useful for managing state.

I spent the most time making sure the different user roles worked correctly, since recipients, donors, and admins all need different views and permissions. I specifically made Sami the admin user in the system as it worked better that way for testing and demonstrating the admin functionality.

The error handling and form validation were important parts of creating a good user experience. I made sure to validate passwords properly and show helpful error messages when something goes wrong.
