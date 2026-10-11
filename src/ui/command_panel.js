/* Shared command presentation. Commands retain ownership of drafts and validation. */
(() => {
  "use strict";
  function create({ document, host, readState, onAction, onSetting, onSelect, onRemove }) {
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
      const schema = JSON.stringify([state.id, (state.selections || []).map(group => group.key),
        (state.settings || []).map(setting => [setting.key, setting.type, setting.group, setting.options?.map(option => option.value)]), (state.actions || []).map(action => action.id)]);
      if (schema !== structure) {
        structure = schema;
        view = { title: node("h2"), step: node("p", null, "command-panel-step"), groups: [], settings: [],
          message: node("p", null, "command-panel-message"), actions: [] };
        panel.replaceChildren(view.title, view.step);
        for (const group of state.selections || []) {
          const section = node("div", null, "command-panel-selection");
          const heading = node("div", null, "command-panel-input");
          heading.id = "commandPanelInput-" + group.key;
          section.append(heading);
          const list = node("ul");
          list.tabIndex = 0;
          list.dataset.input = group.key;
          list.setAttribute("role", "listbox");
          list.setAttribute("aria-labelledby", heading.id);
          section.append(list);
          panel.append(section);
          view.groups.push({ section, heading, list, signature: "", items: [] });
        }
        const settingGroups = new Map();
        for (const setting of state.settings || []) {
          const label = node(setting.type === "radio-grid" ? "div" : "label", null, "command-panel-setting");
          const text = node("span");
          label.append(text);
          const input = node(setting.type === "radio-grid" ? "div" : setting.type === "textarea" ? "textarea" : setting.type === "select" ? "select" : "input");
          if (setting.type === "radio-grid") {
            input.className = "annotation-anchor-grid"; input.setAttribute("role", "radiogroup");
            for (const option of setting.options || []) {
              const cell = node("label"), radio = node("input"); radio.type = "radio"; radio.name = "command-" + setting.key; radio.value = option.value; radio.dataset.setting = setting.key;
              cell.append(radio, node("span", option.label)); input.append(cell);
            }
          }
          else if (setting.type === "textarea") input.rows = 3;
          else if (setting.type === "select") { for (const option of setting.options || []) { const element = node("option", option.label); element.value = option.value; input.append(element); } }
          else input.type = setting.type || "number";
          input.dataset.setting = setting.key;
          label.append(input);
          let container = panel;
          if (setting.group) {
            if (!settingGroups.has(setting.group)) {
              const details = node("details", null, "command-panel-settings-group"); details.append(node("summary", setting.group)); panel.append(details); settingGroups.set(setting.group, details);
            }
            container = settingGroups.get(setting.group);
          }
          container.append(label);
          view.settings.push({ input, text, label });
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
        entry.section.classList.toggle("active", Boolean(group.active));
        entry.list.dataset.emptyLabel = group.emptyLabel || "";
        const next = JSON.stringify(group.items.map(item => item.key));
        if (entry.signature !== next) {
          entry.signature = next;
          const hadFocus = entry.list.contains(document.activeElement);
          entry.items = group.items.map((item, itemIndex) => {
            const row = node("li");
            row.tabIndex = 0;
            row.setAttribute("role", "option");
            row.dataset.input = group.key;
            row.dataset.inputItem = String(itemIndex);
            return row;
          });
          entry.list.replaceChildren(...entry.items);
          if (hadFocus) entry.list.focus();
        }
        group.items.forEach((item, itemIndex) => {
          const row = entry.items[itemIndex];
          row.textContent = item.label;
          row.setAttribute("aria-selected", String(Boolean(item.selected)));
        });
      });
      (state.settings || []).forEach((setting, index) => {
        const { input, text, label } = view.settings[index];
        label.hidden = Boolean(setting.hidden);
        input.dataset.live = String(Boolean(setting.live));
        input.readOnly = Boolean(setting.readOnly);
        if (setting.type === "textarea") { input.rows = setting.rows || 3; input.wrap = setting.rows ? "off" : "soft"; input.dataset.affix = String(Boolean(setting.rows)); }
        input.placeholder = setting.placeholder || "";
        if (setting.type === "select") [...input.options].forEach((option, i) => { option.textContent = setting.options[i].label; });
        if (setting.type === "radio-grid") [...input.querySelectorAll('input')].forEach(radio => { radio.checked = radio.value === setting.value; radio.parentElement.querySelector('span').textContent = setting.options.find(option => option.value === radio.value).label; });
        text.textContent = setting.label;
        input.setAttribute("aria-label", setting.label);
        // Keep the live input node and unsent text through selection/preview updates.
        if (input.type === "checkbox") input.checked = Boolean(setting.value);
        else if (document.activeElement !== input) input.value = String(setting.value ?? "");
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
      const row = event.target.closest("[data-input]");
      if (row) { onSelect?.(row.dataset.input, row.dataset.inputItem == null ? null : Number(row.dataset.inputItem)); return; }
      const button = event.target.closest("button[data-action]");
      if (button && !button.disabled) onAction(button.dataset.action);
    });
    panel.addEventListener("input", event => {
      if ((event.target.tagName === "TEXTAREA" || event.target.dataset.live === "true") && event.target.dataset.setting) onSetting(event.target.dataset.setting, event.target.value);
    });
    panel.addEventListener("change", event => {
      const input = event.target;
      if (input.dataset.setting) onSetting(input.dataset.setting, input.type === "checkbox" ? input.checked : input.value);
    });
    panel.addEventListener("keydown", event => {
      const row = event.target.closest("[data-input]");
      const list = event.target.closest('[role="listbox"]');
      if (list && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const items = [...list.children];
        const current = items.indexOf(event.target);
        const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : Math.max(0, Math.min(items.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
        if (items[index]) {
          items[index].focus();
          onSelect?.(list.dataset.input, index);
        }
        return;
      }
      if (row && ["Delete", "Backspace"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (row.dataset.inputItem != null) onRemove?.(row.dataset.input, Number(row.dataset.inputItem));
        return;
      }
      if (row && ["Enter", " "].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Enter" && readState()?.completeOnEnter) {
          const finish = readState().actions.find(action => action.id === "finish");
          if (finish && !finish.disabled) onAction("finish");
          return;
        }
        onSelect?.(row.dataset.input, row.dataset.inputItem == null ? null : Number(row.dataset.inputItem));
        return;
      }
      if (event.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onAction("cancel"); }
      if (event.key === "Enter" && event.target.tagName === "TEXTAREA") { event.stopPropagation(); return; }
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
