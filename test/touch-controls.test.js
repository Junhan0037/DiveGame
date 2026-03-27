const test = require("node:test");
const assert = require("node:assert/strict");

const { bindHoldButton } = require("../js/touch-controls.js");

function createFakeButton() {
  const listeners = new Map();

  return {
    listeners,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
}

test("bindHoldButton registers hold and native-ui suppression handlers", () => {
  const button = createFakeButton();
  const activations = [];

  bindHoldButton(button, "left", (direction, value) => {
    activations.push([direction, value]);
  });

  const pointerDown = button.listeners.get("pointerdown");
  const pointerUp = button.listeners.get("pointerup");
  const pointerLeave = button.listeners.get("pointerleave");
  const pointerCancel = button.listeners.get("pointercancel");
  const contextMenu = button.listeners.get("contextmenu");
  const dragStart = button.listeners.get("dragstart");

  assert.equal(typeof pointerDown, "function");
  assert.equal(typeof pointerUp, "function");
  assert.equal(typeof pointerLeave, "function");
  assert.equal(typeof pointerCancel, "function");
  assert.equal(typeof contextMenu, "function");
  assert.equal(typeof dragStart, "function");

  let prevented = false;
  pointerDown({
    cancelable: true,
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.deepEqual(activations, [["left", true]]);

  pointerUp();
  pointerLeave();
  pointerCancel();

  assert.deepEqual(activations, [
    ["left", true],
    ["left", false],
    ["left", false],
    ["left", false],
  ]);
});

test("bindHoldButton suppresses context menu and drag start defaults", () => {
  const button = createFakeButton();

  bindHoldButton(button, "right", () => {});

  for (const eventName of ["contextmenu", "dragstart"]) {
    let prevented = false;
    button.listeners.get(eventName)({
      cancelable: true,
      preventDefault() {
        prevented = true;
      },
    });

    assert.equal(prevented, true);
  }
});
