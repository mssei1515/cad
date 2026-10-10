/* Adapt annotation drafts to the shared command panel. */
(() => {
  "use strict";
  function create({ command, effectiveStyle = item => window.Appearance.resolveLeaderAppearance({}, {}, {}, item.style), applicationText: t }) {
    function readState() {
      const draft = command.draft;
      if (!draft) return null;
      const attaching = Boolean(draft.editId);
      const step = attaching || draft.type === 'annotation-leader-select'
        ? t('引出線を付ける図形をクリックしてください', 'Click the geometry to attach the leader.')
        : !draft.withLeader ? t('配置位置をクリックすると追加します', 'Click the text position to add an annotation.')
        : !draft.elbow ? t('引出線の折れ位置をクリックしてください', 'Click the elbow position.')
        : t('横線の終端をクリックすると追加します', 'Click the shelf end to add an annotation.');
      const settings = [];
      if (!attaching) {
        const parameter = Boolean(draft.parameterEnabled), style = draft.style;
        const effective = effectiveStyle({ type: draft.withLeader ? 'leader' : 'text', appearanceInheritance: true, style });
        const field = (key, ja, en, type, value, extra = {}) => settings.push({ key, label: t(ja, en), type, value, ...extra });
        field('withLeader', '引出線あり', 'With leader', 'checkbox', draft.withLeader);
        field('parameterEnabled', 'パラメータを使用', 'Use parameter', 'checkbox', parameter);
        field('text', '本文', 'Text', 'textarea', draft.text, { hidden: parameter });
        field('parameterName', 'Parameter名', 'Parameter name', 'text', draft.parameterName, { hidden: !parameter, live: true });
        field('style.prefix', '接頭辞', 'Prefix', 'textarea', style.prefix || '', { hidden: !parameter, rows: Math.max(1, (style.prefix || '').split(/\r\n|\r|\n/).length) });
        field('expression', '値 / 数式', 'Value / Expression', 'text', draft.expression, { hidden: !parameter, live: true });
        field('style.precision', '小数点以下の桁数', 'Decimal places', 'select', style.precision ?? 'auto', { hidden: !parameter,
          options: [{ value: 'auto', label: t('自動', 'Auto') }, ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) }))] });
        field('style.suffix', '接尾辞', 'Suffix', 'textarea', style.suffix || '', { hidden: !parameter, rows: Math.max(1, (style.suffix || '').split(/\r\n|\r|\n/).length) });
        const valid = command.validContent();
        field('evaluated', '評価値', 'Evaluated value', 'text', parameter && valid ? command.evaluatedValue() ?? '—' : '—', { hidden: !parameter, readOnly: true });
        const group = t('注記の外観', 'Annotation Appearance');
        field('visible', '表示', 'Visible', 'checkbox', draft.visible !== false, { group });
        const appearance = (key, ja, en, options = null, extra = {}) => {
          const factor = key === 'rotation' ? 180 / Math.PI : key === 'displayScale' ? 100 : 1;
          const value = style[key] == null ? '' : typeof style[key] === 'number' ? Number((style[key] * factor).toPrecision(10)) : String(style[key]);
          const inherited = options ? options.find(([value]) => String(value) === String(effective[key])) : null;
          const inheritedLabel = inherited ? t(inherited[1], inherited[2]) : typeof effective[key] === 'number' ? Number((effective[key] * factor).toPrecision(6)) : effective[key];
          field('style.' + key, ja, en, options ? 'select' : key === 'color' ? 'text' : 'number', value, {
            group, placeholder: `${t('既定', 'Default')} (${inheritedLabel})`,
            ...(options ? { options: [{ value: '', label: `${t('既定', 'Default')} (${inheritedLabel})` }, ...options.map(([value, ja, en]) => ({ value: String(value), label: t(ja, en) }))] } : { step: 'any' }), ...extra });
        };
        appearance('color', '色', 'Color');
        appearance('lineWidth', '線幅', 'Line width', null, { min: 0.5, max: 10, hidden: !draft.withLeader });
        appearance('lineType', '線種', 'Line type', [['solid','実線','Solid'],['dashed','破線','Dashed'],['dashdot','一点鎖線','Dash-dot'],['dashdotdot','二点鎖線','Dash-dot-dot'],['dotted','点線','Dotted']], { hidden: !draft.withLeader });
        appearance('terminatorType', '端末記号', 'Terminator', [['arrow','標準矢印','Standard arrow'],['filledArrow','塗りつぶし矢印','Filled arrow'],['dot','点','Dot'],['none','なし','None']], { hidden: !draft.withLeader });
        appearance('terminatorSize', '端末サイズ (mm)', 'Terminator size (mm)', null, { min: 0.1, max: 1000, hidden: !draft.withLeader });
        appearance('arrowheadAngle', '開き角 (°)', 'Opening angle (°)', null, { min: 1, max: 179, hidden: !draft.withLeader || !['arrow','filledArrow'].includes(effective.terminatorType) });
        appearance('fixedDisplaySize', 'サイズロック', 'Size lock', [[false,'あり','Enabled'],[true,'なし','Disabled']]);
        appearance('displayScale', '基準倍率 (%)', 'Reference zoom (%)', null, { min: 0.000001, hidden: effective.fixedDisplaySize !== false });
        appearance('textHeight', '文字高さ (mm)', 'Text height (mm)', null, { min: 0.5, max: 100 });
        appearance('textGap', '文字と横線の間隔 (mm)', 'Text gap from shelf (mm)', null, { min: 0, max: 1000, hidden: !draft.withLeader });
        appearance('fontFamily', 'フォント', 'Font', [['sans-serif','ゴシック体','Sans serif'],['serif','明朝体','Serif'],['monospace','等幅','Monospace']]);
        appearance('bold', '太字', 'Bold', [[true,'あり','Enabled'],[false,'なし','Disabled']]);
        appearance('italic', '斜体', 'Italic', [[true,'あり','Enabled'],[false,'なし','Disabled']]);
        appearance('textAlign', '文字揃え', 'Text alignment', [['left','左揃え','Left'],['center','中央揃え','Center'],['right','右揃え','Right']]);
        appearance('rotation', '回転 (°)', 'Rotation (°)', null, { min: -3600, max: 3600 });
      }
      return { id: attaching ? 'annotation-attach' : 'annotation', title: t('注記', 'Annotation'), step, settings,
        message: draft.error || (attaching ? t('対象を確認して完了してください', 'Review the target and finish.') : t('配置後も設定を保持します。終了またはEscでコマンドを終了します。', 'Settings are retained after placement. Choose Done or press Esc to end.')),
        actions: [{ id: 'finish', label: attaching ? t('完了', 'Finish') : t('終了', 'Done'), disabled: !command.canFinish() },
          ...(attaching ? [{ id: 'cancel', label: t('キャンセル', 'Cancel') }] : [])] };
    }
    return Object.freeze({ readState, onSetting: command.changeSetting,
      onAction: action => action === 'finish' ? command.finish() : command.cancel() });
  }
  window.AnnotationCommandPanel = Object.freeze({ create });
})();
