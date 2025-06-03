import type { IpcRenderer } from "electron";
import {
  type ChatSummary,
  ChatSummariesSchema,
  type UserSettings,
} from "../lib/schemas";
import type {
  App,
  AppOutput,
  Chat,
  ChatResponseEnd,
  CreateAppParams,
  CreateAppResult,
  ListAppsResponse,
  NodeSystemInfo,
  Message,
  Version,
  SystemDebugInfo,
  LocalModel,
  TokenCountParams,
  TokenCountResult,
  ChatLogsData,
  BranchResult,
  LanguageModelProvider,
  LanguageModel,
  CreateCustomLanguageModelProviderParams,
  CreateCustomLanguageModelParams,
  DoesReleaseNoteExistParams,
  ApproveProposalResult,
  ImportAppResult,
  ImportAppParams,
  RenameBranchParams,
} from "./ipc_types";
import type { ProposalResult } from "@/lib/schemas";
import { showError } from "@/lib/toast";

declare global {
  interface Window {
    electron?: {
      ipcRenderer?: IpcRenderer;
    };
  }
}

export class IpcClient {
  private static instance: IpcClient;
  private ipcRenderer: IpcRenderer;
  private chatStreams: Map<number, any>;
  private appStreams: Map<number, any>;

  private constructor() {
    const ipc = window?.electron?.ipcRenderer;
    if (!ipc) {
      console.warn("Electron ipcRenderer not available – running in browser?");
      // @ts-ignore
      this.ipcRenderer = {
        invoke: () => Promise.resolve(null),
        on: () => {},
        removeListener: () => {},
        removeAllListeners: () => {},
      };
    } else {
      this.ipcRenderer = ipc;
    }

    this.chatStreams = new Map();
    this.appStreams = new Map();

    this.ipcRenderer.on?.("chat:response:chunk", (data: any) => {
      const { chatId, messages } = data;
      const callbacks = this.chatStreams.get(chatId);
      if (callbacks) callbacks.onUpdate(messages);
    });

    this.ipcRenderer.on?.("chat:response:end", (data: any) => {
      const { chatId } = data;
      const callbacks = this.chatStreams.get(chatId);
      if (callbacks) {
        callbacks.onEnd(data);
        this.chatStreams.delete(chatId);
      }
    });

    this.ipcRenderer.on?.("chat:response:error", (error: any) => {
      for (const [chatId, callbacks] of this.chatStreams.entries()) {
        callbacks.onError(error);
        this.chatStreams.delete(chatId);
      }
    });

    this.ipcRenderer.on?.("app:output", (data: any) => {
      const { appId } = data;
      const callbacks = this.appStreams.get(appId);
      if (callbacks) callbacks.onOutput({ ...data, timestamp: Date.now() });
    });
  }

  public static getInstance(): IpcClient {
    if (!IpcClient.instance) {
      IpcClient.instance = new IpcClient();
    }
    return IpcClient.instance;
  }

  public async getAppVersion(): Promise<string> {
    const result = await this.ipcRenderer.invoke("get-app-version");
    return result?.version || "0.0.0";
  }

  // يمكنك إضافة بقية الدوال بنفس الأسلوب باستخدام this.ipcRenderer.invoke(...)
}
