# Aura Diary - Backend ✨🚀

The powerful backend API for Aura Diary, built with Node.js, Express, and PostgreSQL.

## Deployment
This project is configured for deployment on **Vercel** as a serverless function. 

> [!IMPORTANT]
> Since Vercel functions are ephemeral, local file uploads to `/uploads` will not persist across requests. It is recommended to use a cloud storage provider like Cloudinary or AWS S3 for production media storage.

## Tech Stack
- Node.js
- Express
- PostgreSQL (Neon)
- JWT Authentication
- Multer (Media handling)

## Getting Started
1. `npm install`
2. Configure `.env` with `DATABASE_URL` and `JWT_SECRET`.
3. `npm run dev`

---
Made with ✨ by Monic Dayana
