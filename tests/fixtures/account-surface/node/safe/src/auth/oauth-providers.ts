// Safe twin of the `email-linking` fixture. A detector must stay silent here.
import EmailProvider from 'next-auth/providers/email';
import GitHubProvider from 'next-auth/providers/github';

export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    EmailProvider({ server: process.env.EMAIL_SERVER! }),
  ],
};
