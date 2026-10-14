// Fixture for the `email-linking` class. Planted defect, never shipped code.
import EmailProvider from 'next-auth/providers/email';
import GitHubProvider from 'next-auth/providers/github';

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // PLANTED: any provider that asserts an address takes over the local
      // account holding it, verified or not.
      allowDangerousEmailAccountLinking: true,
    }),
    EmailProvider({ server: process.env.EMAIL_SERVER! }),
  ],
};
