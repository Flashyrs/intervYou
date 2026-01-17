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
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      try {
        if (account) token.provider = account.provider;

        if (user) {
          token.id = user.id;
        }

        if (token.email) {
          // Verify database connection during auth
          const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
          if (dbUser) {
            token.id = dbUser.id;
          }
        }
      } catch (error) {
        console.error("JWT Callback Error:", error);
        // We don't throw here to avoid completely killing the token, but the session might be incomplete
      }
      return token;
    },
    async session({ session, token }) {

      if (!session.user) session.user = {};
      if (token?.provider) (session as any).provider = token.provider;
      if (token?.id) (session.user as any).id = token.id;
      else if (token?.sub) (session.user as any).id = token.sub;


      return session;
    },
  },
  debug: true,
};
