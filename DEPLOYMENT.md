# Deploying to Render + MongoDB Atlas

This project deploys as two Render services and one MongoDB Atlas database:

- `medical-store-api`: Node/Express backend from `backend`
- `medical-store-frontend`: Vite static frontend from `frontend`
- MongoDB Atlas `M0` free cluster for the database

The backend web service uses Render's free instance type. Static sites are already free on Render and do not use a `plan` field in `render.yaml`.

## 1. Create MongoDB Atlas Database

1. Create a free MongoDB Atlas `M0` cluster.
2. Create a database user with a strong password.
3. In Network Access, allow Render to connect. For the free tier, the simplest option is `0.0.0.0/0`.
4. Copy the connection string and replace the password and database name, for example:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/medical_store?retryWrites=true&w=majority
```

## 2. Deploy on Render

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Render, choose **New > Blueprint**.
3. Select this repo. Render will read `render.yaml`.
4. Fill the secret environment variables when Render asks for them.

Backend variables:

```text
MONGODB_URI=<your MongoDB Atlas connection string>
MONGODB_DB_NAME=medical_store
FRONTEND_URL=https://medical-store-frontend.onrender.com
SMTP_USER=<your email address>
SMTP_PASS=<your email app password>
FROM_EMAIL=<your email address>
```

Frontend variables:

```text
VITE_API_URL=https://medical-store-api.onrender.com/api
```

If Render changes either service URL because the service name is already taken, update `FRONTEND_URL` and `VITE_API_URL` with the actual URLs from your Render dashboard.

Make sure `MONGODB_DB_NAME` matches the Atlas database that contains your app collections. The expected collection names are Mongoose's default plural names, such as `users`, `medicines`, `inventories`, `bills`, `suppliers`, `purchases`, `assets`, and `hsns`.

## 3. Verify

1. Open the backend health check:

```text
https://medical-store-api.onrender.com/api/health
```

2. Open the frontend:

```text
https://medical-store-frontend.onrender.com
```

3. Try logging in and confirm dashboard API calls work.

## Notes

- Render free web services can sleep after inactivity, so the first backend request may be slow.
- Do not commit real `.env` values.
- `VITE_API_URL` is used at frontend build time. If you change it in Render, redeploy the frontend.
