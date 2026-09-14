/* Shared modal choices. Callers supply text and stable choice values. */
(function () {
  "use strict";

  function create(dialog) {
    const title = dialog.querySelector("[data-choice-title]");
    const message = dialog.querySelector("[data-choice-message]");
    const actions = dialog.querySelector("[data-choice-actions]");
    const close = dialog.querySelector("[data-choice-close]");
    let pending = null;

    function finish(value) {
      if (!pending) return;
      const resolve = pending;
      pending = null;
      dialog.close();
      actions.replaceChildren();
      resolve(value);
    }

    close.addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => {
      if (pending && !dialog.open) finish(null);
    });
    // Keep application shortcuts from reaching the canvas beneath the modal.
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    dialog.addEventListener("keyup", (event) => event.stopPropagation());

    return Object.freeze({
      show({ title: heading, message: description, choices, defaultValue, cancelLabel, closeLabel = cancelLabel }) {
        if (pending) return Promise.reject(new Error("A choice dialog is already open"));
        title.textContent = heading;
        message.textContent = description;
        close.setAttribute("aria-label", closeLabel);
        actions.replaceChildren();
        let defaultButton;
        for (const choice of [...choices, { value: null, label: cancelLabel }]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = choice.label;
          button.dataset.choiceValue = choice.value === null ? "cancel" : String(choice.value);
          if (choice.value === defaultValue) {
            button.classList.add("primary");
            defaultButton = button;
          }
          button.addEventListener("click", () => finish(choice.value));
          actions.append(button);
        }
        return new Promise((resolve) => {
          pending = resolve;
          dialog.showModal();
          (defaultButton || actions.firstElementChild).focus();
        });
      },
    });
  }

  window.ChoiceDialog = Object.freeze({ create });
})();
