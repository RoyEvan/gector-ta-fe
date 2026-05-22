import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const backendUrl = process.env.NEXT_PUBLIC_SKRIPSI_GECTAGGING_BACKEND_URL;

const handler = NextAuth({
  // Configure one or more authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.SKRIPSI_GECTAGGING_GOOGLE_CLIENT_ID!,
      clientSecret: process.env.SKRIPSI_GECTAGGING_GOOGLE_CLIENT_SECRET!,
      id: "google",
    }),
  ],
  secret: process.env.SKRIPSI_GECTAGGING_NEXTAUTH_SECRET,
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
      const signInReq = await fetch(`${backendUrl}/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email }),
      })
      const signInRes = await signInReq.json()
      
      user.user_id = signInRes.data?.user_id;
      user.username = signInRes.data?.username;

      if(!signInRes.data) {
        const signUpReq = await fetch(`${backendUrl}/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            username: user.name,
          }),
        })
        const signUpRes = await signUpReq.json()
        user.user_id = signUpRes.data?.user_id;
        user.username = signUpRes.data?.username;
      }

      return true;
    },
    async jwt ({ token, user, account }) {
      if(user) {
        token.user_id = user.user_id
        token.username = user.username
      }

      return token;
    },
    async session({ session, token, user}) {
      session.user!.user_id = token.user_id;
      session.user!.username = token.username;
      
      return session;
    }
  }
});

export {handler as GET, handler as POST};