import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

const PASSCODE_VALIDITY_MS = 30 * 60 * 1000; // 30 minutes

export function usePasscodeGate() {
  const [showModal, setShowModal] = useState(false);

  const verifyPasscode = useAppStore((s) => s.verifyPasscode);
  const passcodeVerified = useAppStore((s) => s.passcodeVerified);

  // Check if passcode is still valid (within 30 min)
  const isLocked = useCallback(() => {
    if (!passcodeVerified) return true;
    const ts = localStorage.getItem('pt_passcode_verified');
    if (!ts) return true;
    return Date.now() - parseInt(ts, 10) > PASSCODE_VALIDITY_MS;
  }, [passcodeVerified]);

  const verify = useCallback(
    (code) => {
      const ok = verifyPasscode(code);
      if (ok) {
        setShowModal(false);
      }
      return ok;
    },
    [verifyPasscode]
  );

  return {
    isLocked: isLocked(),
    verify,
    showModal,
    setShowModal,
  };
}
