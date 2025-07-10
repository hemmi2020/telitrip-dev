# Node.js Express API with JWT Authentication

A RESTful API with JWT authentication, MongoDB, and user/admin management features.

## Features

- JWT-based authentication system
- User management (signup, login, profile, password reset)
- Email verification system
- Admin management with role-based access control
- MongoDB integration
- Secure password handling
- Input validation and error handling

## Requirements

- Node.js 14+
- MongoDB 4+
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Start the server
   ```
   npm run dev
   ```

## API Routes

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login a user
- `POST /api/auth/super-admin/login` - Login as super admin
- `POST /api/auth/forgot-password` - Request password reset
- `PATCH /api/auth/reset-password/:token` - Reset password with token
- `GET /api/auth/verify/:token` - Verify account with token
- `PATCH /api/auth/update-password` - Update password (authenticated)

### Users

- `GET /api/users/me` - Get own profile (authenticated)
- `PATCH /api/users/update-me` - Update profile (authenticated)
- `DELETE /api/users/delete-me` - Delete own account (authenticated)

### Admin Management (Super Admin Only)

- `POST /api/admin` - Create a new admin
- `GET /api/admin` - Get all admins
- `GET /api/admin/:id` - Get admin by ID
- `DELETE /api/admin/:id` - Delete admin
- `PATCH /api/admin/:id/password` - Change admin password

## Security Features

- Password hashing with bcrypt
- JWT authentication
- CORS protection
- Input validation
- Error handling
- Rate limiting