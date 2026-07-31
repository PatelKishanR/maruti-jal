import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      locale: string;
      sessionVersion: number;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    locale?: string;
    sessionVersion?: number;
    keepSignedIn?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: string;
    locale?: string;
    sessionVersion?: number;
    keepSignedIn?: boolean;
  }
}

export {};
