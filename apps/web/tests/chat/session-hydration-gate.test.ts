import assert from "node:assert/strict";
import test from "node:test";
import {
  phaseForRestoredStatus,
  restoredTurnStatus,
  SessionGenerationGate,
} from "../../features/chat/services/session-hydration";

test("a newer session hydration invalidates and aborts the older one", () => {
  const gate = new SessionGenerationGate();
  const first = gate.begin("session-a");
  const second = gate.begin("session-b");

  assert.equal(first.isCurrent(), false);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(second.isCurrent(), true);
  assert.equal(second.sessionId, "session-b");
});

test("cancel invalidates pending hydration and reset cannot be resumed", () => {
  const gate = new SessionGenerationGate();
  const pending = gate.begin("session-a");

  gate.cancel();

  assert.equal(pending.isCurrent(), false);
  assert.equal(pending.controller.signal.aborted, true);
  assert.equal(gate.current(), null);
});

test("completed, failed, stopped, and historical streaming restore without busy", () => {
  assert.deepEqual([
    phaseForRestoredStatus("done"),
    phaseForRestoredStatus("failed"),
    phaseForRestoredStatus("stopped"),
    phaseForRestoredStatus("streaming"),
  ], ["READY", "FAILED", "STOPPED", "STOPPED"]);
  assert.equal(restoredTurnStatus("streaming"), "stopped");
});
