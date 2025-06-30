# Google OAuth Setup Guide

This guide explains how to set up Google OAuth2 authentication for the education platform.

## Features Implemented

- **Google Sign In/Sign Up** - Users can authenticate using their Google accounts
- **Account Linking** - Link Google accounts to existing email/password accounts
- **Secure Token Verification** - Backend verifies Google ID tokens using Google's public keys
- **Onboarding Integration** - New Google users are automatically redirected to onboarding
- **Session Management** - Seamless integration with existing JWT session system
- **Account Security** - Prevents account takeover through proper validation

## Prerequisites

1. Google Cloud Console Project
2. OAuth 2.0 Client IDs configured
3. Proper domain verification (for production)

## Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (for user profile information)

### 2. Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (for public applications)
3. Fill in required information:
   - App name: "Inti Education Platform"
   - User support email: Your support email
   - App logo: Upload your app logo
   - Authorized domains: Add your domains (e.g., `yourdomain.com`)
   - Developer contact information: Your email

### 3. Create OAuth 2.0 Client IDs

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Configure:
   - Name: "Inti Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://yourdomain.com/api/auth/callback/google` (production)

5. Save and copy the Client ID and Client Secret

## Environment Variables

### Backend (.env)

Add these variables to your backend `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### Frontend (.env.local)

Add these variables to your frontend `.env.local` file:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Google OAuth Configuration  
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### Generate NextAuth Secret

```bash
# Generate a random secret for NextAuth
openssl rand -base64 32
```

## API Endpoints

### Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/google/login` | Verify Google ID token and login/register user |
| POST | `/api/auth/google/link` | Link Google account to existing user |

### Request/Response Examples

#### Google Login
```bash
POST /api/auth/google/login
Content-Type: application/json

{
  "idToken": "google_id_token_from_frontend"
}
```

Response:
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "student",
    "provider": "google",
    "profileImageUrl": "https://...",
    "hasOnboarded": false
  },
  "token": "jwt_token",
  "isNewUser": true,
  "message": "Account created and logged in successfully"
}
```

## Frontend Integration

### Using the Google Login Button

```tsx
import GoogleLoginButton from '../components/GoogleLoginButton';

function LoginPage() {
  return (
    <div>
      <GoogleLoginButton 
        text="Sign in with Google"
        onSuccess={(session) => {
          console.log('Login successful:', session);
        }}
        onError={(error) => {
          console.error('Login failed:', error);
        }}
      />
    </div>
  );
}
```

### Session Management

The Google OAuth integrates with NextAuth, which provides:

```tsx
import { useSession, signIn, signOut } from 'next-auth/react';

function Component() {
  const { data: session, status } = useSession();
  
  if (status === "loading") return <p>Loading...</p>;
  
  if (session) {
    return (
      <>
        <p>Signed in as {session.user.email}</p>
        <button onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  
  return (
    <>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
    </>
  );
}
```

## Security Considerations

### Token Verification
- Google ID tokens are verified using Google's public keys
- Tokens include audience verification to prevent misuse
- Email verification status is checked before account creation

### Account Linking
- Prevents account takeover by requiring explicit linking
- Links are only allowed if emails match between accounts
- Existing accounts are protected from unauthorized Google linking

### Session Security
- JWT tokens include session IDs for invalidation
- Sessions expire after 8 hours
- Single device login enforcement available

## Error Handling

### Common Error Scenarios

1. **Account Linking Required (409 Conflict)**
   ```json
   {
     "code": "ACCOUNT_LINKING_REQUIRED",
     "message": "An account with this email already exists. Please link your Google account.",
     "email": "user@example.com",
     "existingProvider": "local"
   }
   ```

2. **Invalid Google Token (401 Unauthorized)**
   ```json
   {
     "message": "Invalid Google token"
   }
   ```

3. **Email Not Verified (401 Unauthorized)**
   ```json
   {
     "message": "Google email not verified"
   }
   ```

## Testing

### Local Development

1. Start backend: `npm run start:dev`
2. Start frontend: `npm run dev`
3. Visit `http://localhost:3000/login`
4. Click "Sign in with Google"
5. Complete OAuth flow in popup/redirect

### Production Testing

1. Update OAuth consent screen to published status
2. Add production domains to authorized origins
3. Test with real user accounts
4. Monitor error logs for issues

## Database Schema

### User Model Updates

The user schema includes these OAuth-related fields:

```typescript
// OAuth provider fields  
provider: AuthProvider; // 'local' | 'google'
googleId?: string; // Google user ID
providerId?: string; // Generic provider ID for future use
password?: string; // Optional for OAuth users
```

### Migration Notes

Existing users:
- `provider` defaults to 'local'
- `password` remains required for local users
- Google users don't require passwords

## Troubleshooting

### Common Issues

1. **"Invalid client" error**
   - Check client ID matches exactly
   - Verify domain is authorized
   - Confirm redirect URI is correct

2. **"Token verification failed"**
   - Check server time synchronization
   - Verify Google client ID in backend config
   - Ensure network connectivity to Google APIs

3. **"Redirect URI mismatch"**
   - Check authorized redirect URIs in Google Console
   - Verify NextAuth callback URL configuration
   - Confirm domain matches exactly (including www/non-www)

4. **Session not persisting**
   - Check NextAuth secret is set
   - Verify cookie settings
   - Confirm domain/secure settings

### Debug Tips

- Enable NextAuth debug mode: `debug: true` in NextAuth config
- Check browser network tab for OAuth flow
- Monitor backend logs for token verification errors
- Verify Google Cloud Console audit logs

## Adding New OAuth Providers

The architecture supports adding new providers:

1. **Update User Schema**
   ```typescript
   export enum AuthProvider {
     LOCAL = 'local',
     GOOGLE = 'google',
     FACEBOOK = 'facebook', // New provider
   }
   ```

2. **Create Provider Service**
   ```typescript
   // backend/src/auth/services/facebook-oauth.service.ts
   ```

3. **Add NextAuth Provider**
   ```typescript
   // frontend/pages/api/auth/[...nextauth].ts
   import FacebookProvider from 'next-auth/providers/facebook';
   ```

4. **Update Frontend Components**
   ```tsx
   // Create FacebookLoginButton component
   ```

## Production Deployment

### Environment Variables Checklist

- [ ] `GOOGLE_CLIENT_ID` - Set in both backend and frontend
- [ ] `GOOGLE_CLIENT_SECRET` - Set in both backend and frontend  
- [ ] `NEXTAUTH_URL` - Set to production domain
- [ ] `NEXTAUTH_SECRET` - Set to secure random string

### OAuth Configuration Checklist

- [ ] OAuth consent screen published
- [ ] Production domains added to authorized origins
- [ ] Production callback URLs configured
- [ ] App verification completed (if required)
- [ ] Privacy policy and terms of service linked

### Security Checklist

- [ ] HTTPS enabled on production domain
- [ ] Secure cookie settings configured
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Error handling doesn't expose sensitive information

## Support

For issues with Google OAuth setup:

1. Check Google Cloud Console error logs
2. Review NextAuth documentation
3. Verify environment variables
4. Test with Google OAuth Playground
5. Contact development team with specific error messages

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) 