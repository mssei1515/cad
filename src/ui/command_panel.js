/* Shared command presentation. Commands retain ownership of drafts and validation. */
(() => {
  "use strict";
  function create({ document, host, readState, onAction, onSetting }) {
    const panel = document.createElement("section");
    panel.id = "commandPanel";
    panel.className = "command-panel";
    panel.setAttribute("aria-label", "Command panel");
    panel.hidden = true;
    host.append(panel);
    let signature = "";
    let structure = "";
    let view = null;
    function node(tag, text, className) {
      const element = document.createElement(tag);
      if (text != null) element.textContent = text;
      if (className) element.className = className;
      return element;
    }
    function update() {
      const state = readState();
      if (!state) {
        panel.hidden = true;
        signature = "";
        structure = "";
        if (view) panel.replaceChildren();
        view = null;
        return;
      }
      const next = JSON.stringify(state);
      if (next === signature) return;
      signature = next;
      panel.hidden = false;
      panel.dataset.command = state.id;
      panel.setAttribute("aria-label", state.title);
      const schema = JSON.stringify([state.id, (state.selections || []).map(group => group.label),
        (state.settings || []).map(setting => [setting.key, setting.type]), (state.actions || []).map(action => action.id)]);
      if (schema !== structure) {
        structure = schema;
        view = { title: node("h2"), step: node("p", null, "command-panel-step"), groups: [], settings: [],
          message: node("p", null, "command-panel-message"), actions: [] };
        panel.replaceChildren(view.title, view.step);
        for (const group of state.selections || []) {
          const section = node("div", null, "command-panel-selection");
          const heading = node("strong");
          section.append(heading);
          const list = node("ul");
          section.append(list);
          panel.append(section);
          view.groups.push({ heading, list, signature: "" });
        }
        for (const setting of state.settings || []) {
          const label = node("label", null, "command-panel-setting");
          const text = node("span");
          label.append(text);
          const input = node("input");
          input.type = setting.type || "number";
          input.dataset.setting = setting.key;
          label.append(input);
          panel.append(label);
          view.settings.push({ input, text });
        }
        panel.append(view.message);
        const actions = node("div", null, "command-panel-actions");
        for (const action of state.actions || []) {
          const button = node("button");
          button.type = "button";
          button.dataset.action = action.id;
          actions.append(button);
          view.actions.push(button);
        }
        panel.append(actions);
      }
      view.title.textContent = state.title;
      view.step.textContent = state.step;
      (state.selections || []).forEach((group, index) => {
        const entry = view.groups[index];
        entry.heading.textContent = `${group.label}: ${group.items.length}`;
        const next = JSON.stringify(group.items);
        if (entry.signature !== next) {
          entry.signature = next;
          entry.list.replaceChildren(...group.items.map(item => node("li", item)));
        }
      });
      (state.settings || []).forEach((setting, index) => {
        const { input, text } = view.settings[index];
        text.textContent = setting.label;
        input.setAttribute("aria-label", setting.label);
        // Keep the live input node and unsent text through selection/preview updates.
        if (input.type === "checkbox") input.checked = Boolean(setting.value);
        else if (document.activeElement !== input) input.value = String(setting.value);
        for (const key of ["min", "max", "step"]) if (setting[key] != null) input[key] = setting[key];
      });
      view.message.hidden = !state.message;
      view.message.textContent = state.message || "";
      (state.actions || []).forEach((action, index) => {
        view.actions[index].textContent = action.label;
        view.actions[index].disabled = Boolean(action.disabled);
      });
    }
    panel.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (button && !button.disabled) onAction(button.dataset.action);
    });
    panel.addEventListener("change", event => {
      const input = event.target;
      if (input.dataset.setting) onSetting(input.dataset.setting, input.type === "checkbox" ? input.checked : input.value);
    });
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onAction("cancel"); }
      if (event.key === "Enter") {
        event.preventDefault(); event.stopPropagation();
        if (event.target.dataset.action) {
          if (!event.target.disabled) onAction(event.target.dataset.action);
          return;
        }
        if (event.target.dataset.setting) {
          const input = event.target;
          onSetting(input.dataset.setting, input.type === "checkbox" ? input.checked : input.value);
        }
        const finish = readState()?.actions?.find(action => action.id === "finish");
        if (finish && !finish.disabled) onAction("finish");
      }
    });
    return Object.freeze({ update });
  }
  window.CommandPanel = Object.freeze({ create });
})();
