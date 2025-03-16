import { users, credentials, type User, type InsertUser, type Credential } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createCredential(credential: Credential): Promise<Credential>;
  getCredentialByHash(hash: string): Promise<Credential | undefined>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private credentials: Map<number, Credential>;
  private currentUserId: number;
  private currentCredentialId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.credentials = new Map();
    this.currentUserId = 1;
    this.currentCredentialId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createCredential(credential: Credential): Promise<Credential> {
    const id = this.currentCredentialId++;
    const newCredential = { ...credential, id };
    this.credentials.set(id, newCredential);
    return newCredential;
  }

  async getCredentialByHash(hash: string): Promise<Credential | undefined> {
    return Array.from(this.credentials.values()).find(
      (credential) => credential.hash === hash,
    );
  }
}

export const storage = new MemStorage();
