import { ipcMain } from "electron";
import { db, getDatabasePath } from "../../db";
import { apps, chats } from "../../db/schema";
import { desc, eq } from "drizzle-orm";
import type { App, CreateAppParams, RenameBranchParams } from "../ipc_types";
import fs from "node:fs";
import path from "node:path";
import { getDyadAppPath, getUserDataPath } from "../../paths/paths";
import { spawn } from "node:child_process";
import git from "isomorphic-git";
import { promises as fsPromises } from "node:fs";

// Import our utility modules
import { withLock } from "../utils/lock_utils";
import { getFilesRecursively } from "../utils/file_utils";
import {
  runningApps,
  processCounter,
  killProcess,
  removeAppIfCurrentProcess,
} from "../utils/process_manager";
import { getEnvVar } from "../utils/read_env";
import { readSettings } from "../../main/settings";

import fixPath from "fix-path";
import { getGitAuthor } from "../utils/git_author";
import killPort from "kill-port";
import util from "util";
import log from "electron-log";
import { getSupabaseProjectName } from "../../supabase_admin/supabase_management_client";
import { createLoggedHandler } from "./safe_handle";
import { getLanguageModelProviders } from "../shared/language_model_helpers";
import { startProxy } from "../utils/start_proxy_server";
import { Worker } from "worker_threads";
import { createFromTemplate } from "./createFromTemplate";

const logger = log.scope("app_handlers");
const handle = createLoggedHandler(logger);

let proxyWorker: Worker | null = null;

// Needed, otherwise electron in MacOS/Linux will not be able
// to find node/pnpm.
fixPath();

// تعديل هنا لإضافة git push بعد git commit
async function commitAndPushChanges(appPath: string, filePath: string) {
  await git.add({ fs, dir: appPath, filepath: filePath });
  await git.commit({
    fs,
    dir: appPath,
    message: `Updated ${filePath}`,
    author: await getGitAuthor(),
  });
  await git.push({
    fs,
    http: require("isomorphic-git/http/node"),
    dir: appPath,
    remote: "origin",
    ref: "main",
    onAuth: () => ({ username: process.env.GIT_USERNAME || "", password: process.env.GIT_PASSWORD || "" }),
  });
}

ipcMain.handle(
  "edit-app-file",
  async (
    _,
    {
      appId,
      filePath,
      content,
    }: { appId: number; filePath: string; content: string },
  ): Promise<void> => {
    const app = await db.query.apps.findFirst({
      where: eq(apps.id, appId),
    });

    if (!app) {
      throw new Error("App not found");
    }

    const appPath = getDyadAppPath(app.path);
    const fullPath = path.join(appPath, filePath);

    // Check if the path is within the app directory (security check)
    if (!fullPath.startsWith(appPath)) {
      throw new Error("Invalid file path");
    }

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    await fsPromises.mkdir(dirPath, { recursive: true });

    try {
      await fsPromises.writeFile(fullPath, content, "utf-8");

      // Check if git repository exists and commit the change
      if (fs.existsSync(path.join(appPath, ".git"))) {
        await commitAndPushChanges(appPath, filePath);
      }

      return;
    } catch (error: any) {
      logger.error(`Error writing file ${filePath} for app ${appId}:`, error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  },
);
