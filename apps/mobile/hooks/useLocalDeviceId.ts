import { useEffect, useState } from "react";
import { localDeviceId } from "../lib/push";

export function useLocalDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const nextDeviceId = await localDeviceId();
      if (!active) {
        return;
      }
      setDeviceId(nextDeviceId);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return {
    deviceId,
    isReady: Boolean(deviceId),
  };
}
