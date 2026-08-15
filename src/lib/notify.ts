/**
 * FIVESOM in-app alerts: a signature 3-second chime plus OS-level
 * notifications shown when the app is in the background.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  void audioCtx.resume();
  return audioCtx;
}

/** Unlock audio on the first user gesture so alerts can play later. */
export function primeAlertSound(): void {
  ctx();
}

/**
 * The FIVESOM signature tone — a warm three-note rise with a soft shimmer
 * tail, exactly 3 seconds long.
 */
export function playAlertSound(): void {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.connect(ac.destination);
  master.gain.setValueAtTime(0.9, t0);

  const notes = [
    { f: 587.33, at: 0, dur: 1.1 }, // D5
    { f: 880.0, at: 0.28, dur: 1.2 }, // A5
    { f: 1174.66, at: 0.56, dur: 2.4 }, // D6
  ];

  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const partial = ac.createOscillator();
    const pGain = ac.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(n.f, t0 + n.at);
    partial.type = "triangle";
    partial.frequency.setValueAtTime(n.f * 2, t0 + n.at);
    pGain.gain.setValueAtTime(0.06, t0 + n.at);

    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + n.at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);

    osc.connect(gain);
    partial.connect(pGain);
    pGain.connect(gain);
    gain.connect(master);

    osc.start(t0 + n.at);
    partial.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
    partial.stop(t0 + n.at + n.dur + 0.05);
  }

  // Soft shimmer tail so the cue reads as 3s long.
  const tail = ac.createOscillator();
  const tailGain = ac.createGain();
  tail.type = "sine";
  tail.frequency.setValueAtTime(1760, t0 + 1.4);
  tail.frequency.exponentialRampToValueAtTime(880, t0 + 3);
  tailGain.gain.setValueAtTime(0.0001, t0 + 1.4);
  tailGain.gain.exponentialRampToValueAtTime(0.07, t0 + 1.6);
  tailGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
  tail.connect(tailGain);
  tailGain.connect(master);
  tail.start(t0 + 1.4);
  tail.stop(t0 + 3.05);
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  primeAlertSound();
  const result = await Notification.requestPermission();
  if (result === "granted") void registerNotificationWorker();
  return result;
}

let swReg: ServiceWorkerRegistration | null = null;

export async function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register("/fivesom-sw.js");
    return swReg;
  } catch {
    return null;
  }
}

export type AlertPayload = {
  title: string;
  body: string;
  icon?: string | null;
  url: string;
  tag?: string;
};

/** Show an OS notification (with a Reply action when supported) + chime. */
export async function showFivesomAlert(payload: AlertPayload): Promise<void> {
  playAlertSound();
  if (notificationPermission() !== "granted") return;

  const options: Record<string, unknown> = {
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: payload.url },
    requireInteraction: false,
  };
  if (payload.tag) options["tag"] = payload.tag;

  const reg = swReg ?? (await registerNotificationWorker());
  if (reg) {
    await reg.showNotification(payload.title, {
      ...options,
      actions: [{ action: "reply", title: "Reply" }],
    } as NotificationOptions);
    return;
  }

  const n = new Notification(payload.title, options as NotificationOptions);
  n.onclick = () => {
    window.focus();
    window.location.href = payload.url;
    n.close();
  };
}
