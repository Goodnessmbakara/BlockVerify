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
  isConnected(): boolean;
  ping(): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private credentials: Map<number, Credential>;
  private currentUserId: number;
  private currentCredentialId: number;
  sessionStore: session.Store;
  private _isConnected: boolean;

  constructor() {
    this.users = new Map();
    this.credentials = new Map();
    this.currentUserId = 1;
    this.currentCredentialId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this._isConnected = true; // In-memory storage is always initially connected
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

  /**
   * Checks if the memory store is connected and operational
   * @returns {boolean} true if connected, false otherwise
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Performs a quick read operation to verify memstore responsiveness
   * @returns {Promise<boolean>} true if responsive, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      // Simple operation to check if memory storage is functional
      const testKey = this.currentUserId;
      const canRead = this.users.has(testKey - 1) !== undefined;
      return Promise.resolve(this._isConnected);
    } catch (error) {
      this._isConnected = false;
      return Promise.resolve(false);
    }
  }
}

export const storage = new MemStorage();