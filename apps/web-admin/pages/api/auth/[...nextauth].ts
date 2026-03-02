import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  ],
  
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          // Send Google ID token to our backend for verification and user creation/login
          const response = await axios.post(`${apiUrl}/api/auth/google/login`, {
            idToken: account.id_token,
            accessToken: account.access_token,
          });

          // Store our backend response in the user object
          if (response.data) {
            (user as any).backendUser = response.data.user;
            (user as any).backendToken = response.data.token;
            (user as any).isNewUser = response.data.isNewUser;
          }

          return true;
        } catch (error: any) {
          console.error('Google login failed:', error);
          
          // Handle account linking requirement
          if (error.response?.status === 409 && error.response?.data?.code === 'ACCOUNT_LINKING_REQUIRED') {
            // Store linking info temporarily for redirect
            const linkingData = {
              email: error.response.data.email,
              idToken: account.id_token,
              provider: 'google'
            };
            
            // Redirect directly to linking page by throwing specific error
            throw new Error(`AccountLinking:${Buffer.from(JSON.stringify(linkingData)).toString('base64')}`);
          }
          
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        if (account.provider === 'google') {
          token.backendUser = (user as any).backendUser;
          token.backendToken = (user as any).backendToken;
          token.isNewUser = (user as any).isNewUser;
          token.provider = 'google';
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Send properties to the client
      if (token.backendUser) {
        (session as any).backendUser = token.backendUser;
        (session as any).backendToken = token.backendToken;
        (session as any).isNewUser = token.isNewUser;
        (session as any).provider = token.provider;
      }
      
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Handle account linking redirect
      if (url.includes('error=ACCOUNT_LINKING_REQUIRED')) {
        const urlParams = new URL(url);
        const errorParam = urlParams.searchParams.get('error');
        if (errorParam?.startsWith('ACCOUNT_LINKING_REQUIRED:')) {
          const linkingData = errorParam.replace('ACCOUNT_LINKING_REQUIRED:', '');
          return `${baseUrl}/auth/link-account?data=${encodeURIComponent(linkingData)}`;
        }
      }
      
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },

  pages: {
    error: '/auth/error', // Error code passed in query string as ?error=
  },

  session: {
    strategy: 'jwt',
  },

  debug: process.env.NODE_ENV === 'development',
}); 