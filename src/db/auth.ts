import type { Profile } from "@/domain/types";
import * as categoriesRepo from "./repos/categories";
import * as deviceRepo from "./repos/device";
import * as profilesRepo from "./repos/profiles";
import { DEMO_EMAIL, seedDemoUser } from "./seed-demo";

export async function signup(
  fullName: string,
  email: string,
  password: string,
): Promise<Profile> {
  const existing = await profilesRepo.getByEmail(email);
  if (existing) {
    throw new Error("E-mail já cadastrado.");
  }

  const profile = await profilesRepo.create({ fullName, email, password });
  await categoriesRepo.ensureDefaultCategories(profile.id);
  await deviceRepo.setSession(profile.id);
  return profile;
}

export async function login(
  email: string,
  password: string,
): Promise<Profile> {
  const profile = await profilesRepo.verifyLogin(email, password);
  if (!profile) {
    throw new Error("E-mail ou senha inválidos.");
  }
  await deviceRepo.setSession(profile.id);
  return profile;
}

export async function enterDemo(): Promise<Profile> {
  let profile = await profilesRepo.getByEmail(DEMO_EMAIL);
  if (!profile) {
    profile = await seedDemoUser();
  }
  await deviceRepo.setSession(profile.id);
  return profile;
}

export async function logout(): Promise<void> {
  await deviceRepo.clearSession();
}

export async function getCurrentSession(): Promise<Profile | null> {
  const settings = await deviceRepo.getSettings();
  if (!settings.sessionUserId) {
    return null;
  }
  return profilesRepo.getById(settings.sessionUserId);
}
