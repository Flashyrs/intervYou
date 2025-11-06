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
  async jwt({ token, account }) {
    if (account) token.provider = account.provider;
    return token;
  },
  async session({ session, token }) {
    if (!session.user) session.user = {};
    if (token?.provider) (session as any).provider = token.provider;
    if (token?.sub) (session.user as any).id = token.sub;
    return session;
  },
},
};
