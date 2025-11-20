import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },

  pages: {
    signIn: "/", // optional redirect
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // console.log("JWT Callback:", { token, user, account }); // DEBUG
      if (account) token.provider = account.provider;

      // If we have a user object (sign in), try to use its ID. 
      // But if it looks like a Google ID (numeric), we must fetch the real DB ID (CUID).
      if (user) {
        token.id = user.id;
      }

      // Always verify we have the DB ID by checking email if present
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // console.log("Session Callback - Token:", token); // DEBUG
      if (!session.user) session.user = {};
      if (token?.provider) (session as any).provider = token.provider;
      if (token?.id) (session.user as any).id = token.id;
      else if (token?.sub) (session.user as any).id = token.sub;

      // console.log("Session Callback - Final Session:", session); // DEBUG
      return session;
    },
  },
};
