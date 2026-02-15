"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithInstall = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
};

type Props = {
  className?: string;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as NavigatorWithInstall).standalone === true;
}

async function hasInstalledRelatedApp() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithInstall;
  if (typeof nav.getInstalledRelatedApps !== "function") return false;

  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

export function InstallAppButton({ className }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setHidden(true);
      setDeferredPrompt(null);
    };

    const checkInstalled = async () => {
      if (isInStandaloneMode()) {
        setHidden(true);
        return;
      }

      const installed = await hasInstalledRelatedApp();
      setHidden(installed);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    void checkInstalled();

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        toast.success("Приложение установлено");
        setHidden(true);
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIos()) {
      toast("На iOS: Поделиться -> На экран Домой");
      return;
    }

    toast("Установка недоступна в этом браузере");
  }

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={clsx("rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-black/60", className)}
    >
      Установить
    </button>
  );
}
