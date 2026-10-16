export function createLiveInferenceQueue({ run, accept, release = (frame) => { try { frame?.close?.(); } catch {} } }) {
  let sessionId = null;
  let active = null;
  let pending = null;
  let stopped = true;

  function isCurrent(result) {
    return !stopped && result?.cameraSessionId === sessionId && result.frameId === active?.frameId;
  }

  async function drain(frame) {
    active = frame;
    try {
      const result = await run(frame);
      if (isCurrent(result)) accept(result);
    } finally {
      release(frame.resource);
      active = null;
      if (!stopped && pending) {
        const newest = pending;
        pending = null;
        void drain(newest);
      }
    }
  }

  return {
    start(nextSessionId) {
      sessionId = nextSessionId;
      stopped = false;
    },
    enqueue(frame) {
      if (stopped || frame.cameraSessionId !== sessionId) {
        release(frame.resource);
        return false;
      }
      if (!active) void drain(frame);
      else {
        if (pending) release(pending.resource);
        pending = frame;
      }
      return true;
    },
    stop() {
      stopped = true;
      if (pending) release(pending.resource);
      pending = null;
      sessionId = null;
    },
    getState: () => ({ sessionId, activeFrameId: active?.frameId ?? null, pendingFrameId: pending?.frameId ?? null, stopped })
  };
}
