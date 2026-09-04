import React, { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { OverlayPill } from "./components/OverlayPill";
import { SettingsLayout } from "./components/settings/SettingsLayout";

export const App: React.FC = () => {
  const [windowLabel, setWindowLabel] = useState<string>("main");

  useEffect(() => {
    try {
      const appWindow = getCurrentWebviewWindow();
      setWindowLabel(appWindow.label);
    } catch {
      // Fallback for browser preview
      setWindowLabel("main");
    }
  }, []);

  if (windowLabel === "overlay") {
    return <OverlayPill />;
  }

  return <SettingsLayout />;
};

export default App;
