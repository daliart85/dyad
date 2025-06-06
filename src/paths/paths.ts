import path from "node:path";
import os from "node:os";
import { execSync } from "child_process";

export function getDyadAppPath(appPath: string): string {
  if (process.env.E2E_TEST_BUILD) {
    return path.join("/tmp", "dyad-apps-test", appPath);
  }
  return path.join(os.homedir(), "dyad-apps", appPath);
}

/**
 * Gets the user data path, handling both Electron and non-Electron environments
 * In Electron: returns the app's userData directory
 * In non-Electron: returns "./userData" in the current directory
 */
export function getUserDataPath(): string {
  const electron = getElectron();

  // When running in Electron and app is ready
  if (process.env.NODE_ENV !== "development" && electron) {
    return electron!.app.getPath("userData");
  }

  // For development or when the Electron app object isn't available
  return path.resolve("./userData");
}

/**
 * Get a reference to electron in a way that won't break in non-electron environments
 */
export function getElectron(): typeof import("electron") | undefined {
  let electron: typeof import("electron") | undefined;
  try {
    // Check if we're in an Electron environment
    if (process.versions.electron) {
      electron = require("electron");
    }
  } catch {
    // Not in Electron environment
  }
  return electron;
}

/**
 * Utility to automatically commit and push changes in development mode
 */
export function autoCommitAndPush(message: string = "Auto commit"): void {
  try {
    if (process.env.NODE_ENV === "development") {
      execSync("git add .", { stdio: "inherit" });
      execSync(`git commit -m \"${message}\"`, { stdio: "inherit" });
      execSync("git push", { stdio: "inherit" });
    }
  } catch (error) {
    console.error("Git commit/push failed:", error);
  }
}
