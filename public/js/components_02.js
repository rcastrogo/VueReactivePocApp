'use strict';

/**
 * components_02.js — Librería de componentes RCG
 * ─────────────────────────────────────────────────────────────────────────────
 * Requiere: @vue/reactivity (VueReactivity global), rcg (lib.js)
 *
 * Componentes incluidos:
 *  · app-toast       Notificaciones temporales apiladas (success/warning/danger/info)
 *  · app-modal       Diálogo modal con slot para contenido y acciones custom
 *  · app-tabs        Navegación por pestañas con contenido reactivo
 *  · app-badge       Etiqueta de estado semántica (pill / dot)
 *  · app-dropdown    Menú desplegable con lista de opciones y callback
 *  · app-input       Campo de texto validado con label y mensaje de error
 *  · app-textarea    Área de texto con contador de caracteres
 *  · app-toggle      Interruptor booleano accesible (switch)
 *  · app-spinner     Indicador de carga con tamaño y texto opcionales
 *  · app-empty       Estado vacío con icono SVG, título y acción primaria
 *
 * Uso en HTML:
 *  <div data-component="app-toast" [type]="success" [message]="¡Guardado!" [duration]="3000"></div>
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {

  const { reactive, computed } = VueReactivity;

  // ════════════════════════════════════════════════════════════════════════════
  // app-toast
  // Props : type (success|warning|danger|info), message, duration (ms, 0=manual)
  // Events: close
  //
  // Muestra una notificación flotante en la esquina superior derecha.
  // Si duration > 0 se cierra sola. Emite "close" al cerrarse.
  // ════════════════════════════════════════════════════════════════════════════
  const TOAST = 'app-toast';

  const Toast = rcg.defineComponent(TOAST, (ctx, emit, props) => {

    const state = reactive({ visible: true });

    const colorMap = {
      success: 'border-l-4 border-emerald-400 bg-emerald-50',
      warning: 'border-l-4 border-amber-400  bg-amber-50',
      danger:  'border-l-4 border-red-400    bg-red-50',
      info:    'border-l-4 border-sky-400    bg-sky-50',
    };

    const iconColorMap = {
      success: 'bg-emerald-100 text-emerald-700',
      warning: 'bg-amber-100 text-amber-700',
      danger:  'bg-red-100 text-red-700',
      info:    'bg-sky-100 text-sky-700',
    };

    const iconMap = {
      success: '✔',
      warning: '⚠',
      danger:  '✖',
      info:    'ℹ',
    };

    const toastClass = computed(() => {
      const levelClass = colorMap[props.type] ?? colorMap.info;
      return `pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 p-4 shadow-lg ${levelClass}`;
    });

    const iconClass = computed(() => {
      const toneClass = iconColorMap[props.type] ?? iconColorMap.info;
      return `mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneClass}`;
    });

    const icon = computed(() => iconMap[props.type] ?? iconMap.info);

    const handlers = {
      close() {
        state.visible = false;
        emit('close');
      }
    };

    // Auto-close
    const duration = Number(props.duration ?? 4000);
    if (duration > 0) {
      setTimeout(() => handlers.close(), duration);
    }

    const template = `
      <div
        role="alert"
        aria-live="polite"
        data-bind="show:state.visible; class:toastClass">
        <span
          data-bind="class:iconClass; text:icon">
        </span>
        <p class="flex-1 text-sm font-medium text-slate-800"
           data-bind="props.message | fallback:Notificación">
        </p>
        <button
          aria-label="Cerrar"
          class="text-slate-400 hover:text-slate-700 transition-colors text-lg leading-none"
          on-click="close">
          ×
        </button>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { state, toastClass, iconClass, icon }
    };
  });

  rcg.registerComponent(TOAST, Toast);


  // ════════════════════════════════════════════════════════════════════════════
  // app-modal
  // Props : open (bool), title, size (sm|md|lg)
  // Events: close, confirm
  //
  // Modal accesible con backdrop. Cierra con Escape o click en el backdrop.
  // Emite "confirm" al pulsar el botón de confirmación.
  // ════════════════════════════════════════════════════════════════════════════
  const MODAL = 'app-modal';

  const Modal = rcg.defineComponent(MODAL, (ctx, emit, props) => {

    const sizeMap = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
    };

    const panelClass = computed(() =>
      `relative w-full rounded-2xl bg-white p-6 shadow-2xl ${sizeMap[props.size] ?? sizeMap.md}`
    );

    const isOpen = computed(() => Boolean(props.open));

    const handlers = {
      close() { emit('close'); },
      confirm() { emit('confirm'); },
      backdropClick(e) {
        if (e.ev.target === e.el) handlers.close();
      }
    };

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen.value) handlers.close();
    });

    const template = `
      <div
        role="dialog"
        aria-modal="true"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        data-bind="show:isOpen"
        on-click="backdropClick">
        <div data-bind="class:panelClass">
          <div class="mb-4 flex items-start justify-between gap-4">
            <h2
              class="text-lg font-bold text-slate-900"
              data-bind="props.title | fallback:Modal">
            </h2>
            <button
              aria-label="Cerrar modal"
              class="text-slate-400 hover:text-slate-700 text-xl leading-none transition-colors"
              on-click="close">
              ×
            </button>
          </div>
          <div class="text-sm text-slate-600">
            <slot></slot>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="tool-bar-button border-slate-200"
              on-click="close">
              Cancelar
            </button>
            <button
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              on-click="confirm">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { isOpen, panelClass }
    };
  });

  rcg.registerComponent(MODAL, Modal);


  // ════════════════════════════════════════════════════════════════════════════
  // app-tabs
  // Props : tabs (JSON array de strings, ej: '["Inicio","Perfil","Config"]'),
  //         active (índice inicial, default 0)
  // Events: change (índice seleccionado)
  // ════════════════════════════════════════════════════════════════════════════
  const TABS = 'app-tabs';

  const Tabs = rcg.defineComponent(TABS, (ctx, emit, props) => {

    let parsedTabs = [];
    try {
      parsedTabs = JSON.parse((props.tabs ?? '[]').replace(/'/g, '"'));
    } catch (_) {
      parsedTabs = ['Tab 1', 'Tab 2', 'Tab 3'];
    }

    const state = reactive({
      active: Number(props.active ?? 0),
      tabs: parsedTabs.map((label, i) => ({ label, i }))
    });

    const activeLabel = computed(() => state.tabs[state.active]?.label ?? '');

    const handlers = {
      select(e) {
        state.active = Number(e.arg[0]);
        emit('change', state.active);
      }
    };

    // Construir botones dinámicamente (data-each dentro del template)
    const template = `
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <nav class="flex gap-1 border-b border-slate-200 p-2" role="tablist">
          <div class="contents" data-each="tab in state.tabs">
            <button
              role="tab"
              class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              data-bind="
                class:
                  rounded-lg px-4 py-2 text-sm font-medium transition-colors
                  bg-slate-900 text-white shadow ? tab.i === state.active
                  text-slate-500 hover:bg-slate-100 hover:text-slate-900 ? tab.i !== state.active
              "
              on-click="select:$tab.i">
              <span data-bind="tab.label"></span>
            </button>
          </div>
        </nav>
        <div class="p-4">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pestaña activa
          </p>
          <p class="mt-1 text-base font-bold text-slate-800" data-bind="activeLabel"></p>
        </div>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { state, activeLabel }
    };
  });

  rcg.registerComponent(TABS, Tabs);


  // ════════════════════════════════════════════════════════════════════════════
  // app-badge
  // Props : label, type (success|warning|danger|info|neutral), dot (bool)
  //
  // Etiqueta de estado compacta. dot=true añade un círculo de color a la izquierda.
  // ════════════════════════════════════════════════════════════════════════════
  const BADGE = 'app-badge';

  const Badge = rcg.defineComponent(BADGE, (ctx, emit, props) => {

    const colorMap = {
      success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      warning: 'bg-amber-100  text-amber-800  border-amber-200',
      danger:  'bg-red-100    text-red-800    border-red-200',
      info:    'bg-sky-100    text-sky-800    border-sky-200',
      neutral: 'bg-slate-100  text-slate-700  border-slate-200',
    };

    const dotColorMap = {
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      danger:  'bg-red-500',
      info:    'bg-sky-500',
      neutral: 'bg-slate-400',
    };

    const badgeClass = computed(() =>
      `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorMap[props.type] ?? colorMap.neutral}`
    );

    const dotClass  = computed(() => dotColorMap[props.type] ?? dotColorMap.neutral);
    const showDot   = computed(() => String(props.dot) === 'true');

    const template = `
      <span data-bind="class:badgeClass">
        <span
          class="h-1.5 w-1.5 rounded-full flex-shrink-0"
          data-bind="class:dotClass; show:showDot">
        </span>
        <span data-bind="props.label | fallback:Badge"></span>
      </span>
    `;

    return {
      template,
      ctx: { badgeClass, dotClass, showDot }
    };
  });

  rcg.registerComponent(BADGE, Badge);


  // ════════════════════════════════════════════════════════════════════════════
  // app-dropdown
  // Props : label (texto del botón), options (JSON array de strings)
  // Events: select (opción elegida como string)
  // ════════════════════════════════════════════════════════════════════════════
  const DROPDOWN = 'app-dropdown';

  const Dropdown = rcg.defineComponent(DROPDOWN, (ctx, emit, props) => {

    let parsedOptions = [];
    try {
      parsedOptions = JSON.parse((props.options ?? '[]').replace(/'/g, '"'));
    } catch (_) {
      parsedOptions = ['Opción 1', 'Opción 2', 'Opción 3'];
    }

    const state = reactive({
      open: false,
      selected: null,
      options: parsedOptions
    });

    const displayLabel = computed(() => state.selected ?? props.label ?? 'Seleccionar');

    const handlers = {
      toggle() { state.open = !state.open; },
      pick(e) {
        state.selected = e.arg[0];
        state.open = false;
        emit('select', state.selected);
      }
    };

    // Cierre al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest?.(`[app-dropdown]`)) state.open = false;
    });

    const template = `
      <div class="relative inline-block text-left">
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          on-click="toggle">
          <span data-bind="displayLabel"></span>
          <svg class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        <ul
          class="absolute left-0 z-20 mt-2 min-w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          data-bind="show:state.open"
          role="menu">
          <div class="contents" data-each="option in state.options">
            <li>
              <button
                class="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                on-click="pick:$option"
                role="menuitem">
                <span data-bind="option"></span>
              </button>
            </li>
          </div>
        </ul>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { state, displayLabel }
    };
  });

  rcg.registerComponent(DROPDOWN, Dropdown);


  // ════════════════════════════════════════════════════════════════════════════
  // app-input
  // Props : label, placeholder, type (text|email|password|number), error
  // Events: change (valor como string)
  // ════════════════════════════════════════════════════════════════════════════
  const INPUT = 'app-input';

  const Input = rcg.defineComponent(INPUT, (ctx, emit, props) => {

    const state = reactive({ value: '', touched: false });

    const hasError  = computed(() => Boolean(props.error) && state.touched);
    const inputType = computed(() => props.type ?? 'text');

    const borderClass = computed(() =>
      hasError.value
        ? 'border-red-400 ring-1 ring-red-300 focus:border-red-500'
        : 'border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-200'
    );

    const handlers = {
      onInput(e) {
        state.value   = e.ev.target.value;
        state.touched = true;
        emit('change', state.value);
      }
    };

    const template = `
      <div class="flex flex-col gap-1">
        <label class="text-sm font-semibold text-slate-700"
               data-bind="props.label | fallback:Campo">
        </label>
        <input
          class="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400"
          data-bind="attr.type:inputType; attr.placeholder:props.placeholder; class:borderClass; value:state.value"
          on-input="onInput">
        <p
          class="text-xs text-red-600"
          data-bind="show:hasError; props.error | fallback: ">
        </p>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { state, hasError, inputType, borderClass }
    };
  });

  rcg.registerComponent(INPUT, Input);


  // ════════════════════════════════════════════════════════════════════════════
  // app-textarea
  // Props : label, placeholder, maxlength (default 200), rows (default 4)
  // Events: change (valor como string)
  // ════════════════════════════════════════════════════════════════════════════
  const TEXTAREA = 'app-textarea';

  const Textarea = rcg.defineComponent(TEXTAREA, (ctx, emit, props) => {

    const maxLen = Number(props.maxlength ?? 200);
    const rows   = Number(props.rows ?? 4);

    const state = reactive({ value: '', count: 0 });

    const counterClass = computed(() =>
      state.count >= maxLen
        ? 'text-red-500 font-semibold'
        : state.count >= maxLen * 0.85
        ? 'text-amber-600'
        : 'text-slate-400'
    );

    const remaining = computed(() => maxLen - state.count);

    const handlers = {
      onInput(e) {
        const raw = e.ev.target.value;
        state.value = raw.slice(0, maxLen);
        state.count = state.value.length;
        emit('change', state.value);
      }
    };

    const template = `
      <div class="flex flex-col gap-1">
        <div class="flex items-end justify-between">
          <label class="text-sm font-semibold text-slate-700"
                 data-bind="props.label | fallback:Mensaje">
          </label>
          <span class="text-xs" data-bind="class:counterClass">
            <span data-bind="remaining"></span> restantes
          </span>
        </div>
        <textarea
          class="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-200 placeholder:text-slate-400"
          data-bind="attr.placeholder:props.placeholder; attr.rows:rows; attr.maxlength:maxLen"
          on-input="onInput"></textarea>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { state, counterClass, remaining, rows, maxLen }
    };
  });

  rcg.registerComponent(TEXTAREA, Textarea);


  // ════════════════════════════════════════════════════════════════════════════
  // app-toggle
  // Props : label, checked (bool), disabled (bool)
  // Events: change (bool)
  //
  // Interruptor accesible con role="switch". Completamente controlado por props
  // o por estado interno si checked no está enlazado.
  // ════════════════════════════════════════════════════════════════════════════
  const TOGGLE = 'app-toggle';

  const Toggle = rcg.defineComponent(TOGGLE, (ctx, emit, props) => {

    const state = reactive({
      on: String(props.checked) === 'true'
    });

    const isDisabled = computed(() => String(props.disabled) === 'true');

    const trackClass = computed(() => {
      const stateClass = state.on ? 'bg-sky-500' : 'bg-slate-300';
      const disabledClass = isDisabled.value ? 'cursor-not-allowed opacity-60' : 'cursor-pointer';
      return `relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${stateClass} ${disabledClass}`;
    });

    const thumbClass = computed(() => {
      const positionClass = state.on ? 'translate-x-5' : 'translate-x-0.5';
      return `mt-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${positionClass}`;
    });

    const handlers = {
      flip() {
        if (isDisabled.value) return;
        state.on = !state.on;
        emit('change', state.on);
      }
    };

    const template = `
      <label class="inline-flex cursor-pointer items-center gap-3">
        <button
          role="switch"
          data-bind="class:trackClass; attr.aria-checked:state.on; attr.disabled:isDisabled"
          on-click="flip">
          <span
            data-bind="class:thumbClass">
          </span>
        </button>
        <span
          class="text-sm font-medium text-slate-700"
          data-bind="props.label | fallback:Activar">
        </span>
      </label>
    `;

    return {
      template,
      handlers,
      ctx: { state, trackClass, thumbClass, isDisabled }
    };
  });

  rcg.registerComponent(TOGGLE, Toggle);


  // ════════════════════════════════════════════════════════════════════════════
  // app-spinner
  // Props : size (sm|md|lg), label (texto debajo del spinner)
  // ════════════════════════════════════════════════════════════════════════════
  const SPINNER = 'app-spinner';

  const Spinner = rcg.defineComponent(SPINNER, (ctx, emit, props) => {

    const sizeMap = {
      sm: 'h-5 w-5 border-2',
      md: 'h-8 w-8 border-2',
      lg: 'h-12 w-12 border-4',
    };

    const spinClass = computed(() =>
      `animate-spin rounded-full border-slate-200 border-t-sky-500 ${sizeMap[props.size] ?? sizeMap.md}`
    );

    const hasLabel = computed(() => Boolean(props.label));

    const template = `
      <div class="flex flex-col items-center gap-3">
        <div data-bind="class:spinClass" role="status" aria-label="Cargando"></div>
        <p
          class="text-sm font-medium text-slate-500"
          data-bind="show:hasLabel; props.label | fallback: ">
        </p>
      </div>
    `;

    return {
      template,
      ctx: { spinClass, hasLabel }
    };
  });

  rcg.registerComponent(SPINNER, Spinner);


  // ════════════════════════════════════════════════════════════════════════════
  // app-empty
  // Props : title, description, action (texto del botón)
  // Events: action (al pulsar el botón)
  // ════════════════════════════════════════════════════════════════════════════
  const EMPTY = 'app-empty';

  const Empty = rcg.defineComponent(EMPTY, (ctx, emit, props) => {

    const hasAction = computed(() => Boolean(props.action));

    const handlers = {
      trigger() { emit('action'); }
    };

    const template = `
      <div class="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
        <svg class="h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"/>
        </svg>
        <div class="space-y-1">
          <h3
            class="text-base font-bold text-slate-700"
            data-bind="props.title | fallback:Sin datos">
          </h3>
          <p
            class="text-sm text-slate-500"
            data-bind="props.description | fallback:No hay elementos que mostrar por el momento.">
          </p>
        </div>
        <button
          class="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          data-bind="show:hasAction; props.action | fallback: "
          on-click="trigger">
        </button>
      </div>
    `;

    return {
      template,
      handlers,
      ctx: { hasAction }
    };
  });

  rcg.registerComponent(EMPTY, Empty);

}());
