(function attachTouchControls(root, factory) {
  const api = factory();

  root.DiveGameTouchControls = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTouchControlsApi() {
  "use strict";

  // cancelable 이벤트에서만 기본 동작을 막아 브라우저 경고를 피한다.
  function preventDefaultIfCancelable(event) {
    if (!event || typeof event.preventDefault !== "function" || event.cancelable === false) {
      return false;
    }

    event.preventDefault();
    return true;
  }

  // 방향키 버튼에 길게 누르기 입력과 기본 UI 차단을 함께 바인딩한다.
  function bindHoldButton(button, direction, activate) {
    if (!button || typeof button.addEventListener !== "function" || typeof activate !== "function") {
      return null;
    }

    const onDown = (event) => {
      preventDefaultIfCancelable(event);
      activate(direction, true);
    };
    const onUp = () => {
      activate(direction, false);
    };
    const suppressNativeUi = (event) => {
      preventDefaultIfCancelable(event);
    };

    button.addEventListener("pointerdown", onDown);
    button.addEventListener("pointerup", onUp);
    button.addEventListener("pointerleave", onUp);
    button.addEventListener("pointercancel", onUp);
    button.addEventListener("contextmenu", suppressNativeUi);
    button.addEventListener("dragstart", suppressNativeUi);

    return {
      onDown,
      onUp,
      suppressNativeUi,
    };
  }

  return {
    bindHoldButton,
    preventDefaultIfCancelable,
  };
});
