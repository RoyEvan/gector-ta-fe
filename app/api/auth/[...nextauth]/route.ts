import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
  // Configure one or more authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.TA_GECTAGGING_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.TA_GECTAGGING_GOOGLE_CLIENT_SECRET!,
      id: "google",
    }),
  ],
  secret: process.env.TA_GECTAGGING_NEXTAUTH_SECRET,
  session: {
    maxAge: 60 * 60, // 1 hour
    strategy: 'jwt',
  },
  pages: {
    error: '/',
    signIn: '/',
  },
  callbacks: {
    async signIn({ user, account }) {
      return true;
    },
    async jwt ({ token, user, account }) {
      if(user) {
        const backendUrl = process.env.TA_GECTAGGING_BACKEND_URL
        if (backendUrl) {
          try {
            const req = await fetch(`${backendUrl}/api/signin`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: user.email }),
            })

            if (req.ok) {
              const res = await req.json()
              const data = res.data
              token.user_id = data.user_id
            }
          } catch (error) {
            console.error("Backend signin fetch failed", error)
          }
        }
      }

      return token;
    },
    async session({ session, token, user}) {
      session.user!.user_id = token.user_id;
      
      return session;
    }
  }
});

export {handler as GET, handler as POST};