declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      password_hash: string;
      name: string;
      created_at: Date;
    }
  }
}

export {};
