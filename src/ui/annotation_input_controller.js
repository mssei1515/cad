/* Edit an existing annotation in place; model changes happen only on confirmation. */
(() => {
  "use strict";
  function create({ document, host, getPending, setPending, find, canEdit, prepare, select,
    layout, toScreen, expressionInputValue, commit, draw, updateUI, applicationText: t }) {
    const input = document.createElement('textarea');
    input.id = 'annotationValueInput';
    input.className = 'annotation-value-input';
    input.hidden = true; input.spellcheck = false;
    host.append(input);
    const active = () => getPending()?.type === 'annotation-value';
    function sync() {
      const pending = getPending(), item = active() && find(pending.id);
      input.hidden = !item;
      if (!item) return;
      const box = layout(item), point = toScreen(box);
      input.style.left = `${point.x}px`; input.style.top = `${point.y}px`;
      input.style.fontSize = `${Math.max(12, box.screenFontSize)}px`;
      input.rows = item.parameterEnabled ? 1 : Math.max(1, pending.buffer.split(/\r\n|\r|\n/).length);
      input.dataset.expression = String(Boolean(item.parameterEnabled));
      input.setAttribute('aria-label', item.parameterEnabled ? t('値 / 数式', 'Value / Expression') : t('本文', 'Text'));
      if (input.value !== pending.buffer) input.value = pending.buffer;
    }
    function start(hit) {
      const item = hit?.element;
      if (!item || item.blockProjection) return false;
      if (!canEdit(item)) return true;
      prepare(); select(item);
      setPending({ type: 'annotation-value', id: item.id, buffer: item.parameterEnabled ? expressionInputValue(item.expression || '0') : item.text || '' });
      input.classList.remove('is-invalid');
      updateUI(); draw(); sync(); input.focus(); input.select();
      return true;
    }
    function finish() {
      const pending = getPending(), item = active() && find(pending.id);
      if (!item || !canEdit(item)) return false;
      if (!commit(item, pending.buffer)) { input.classList.add('is-invalid'); return false; }
      setPending(null); input.hidden = true; updateUI(); draw(); return true;
    }
    input.addEventListener('pointerdown', e => e.stopPropagation());
    input.addEventListener('dblclick', e => e.stopPropagation());
    input.addEventListener('input', () => { if (active()) { getPending().buffer = input.value; input.classList.remove('is-invalid'); sync(); } });
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Escape') { e.preventDefault(); setPending(null); sync(); updateUI(); draw(); }
      if (e.key === 'Enter' && (!e.shiftKey || input.dataset.expression === 'true')) { e.preventDefault(); finish(); }
    });
    return Object.freeze({ start, sync, finish });
  }
  window.AnnotationInputController = Object.freeze({ create });
})();
