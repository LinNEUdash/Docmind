import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";

const nextAuth = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        await dbConnect();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
          });
        }
        return true;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return true;
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
});

export async function GET(request: NextRequest) {
  return nextAuth.handlers.GET(request);
}

export async function POST(request: NextRequest) {
  return nextAuth.handlers.POST(request);
}
