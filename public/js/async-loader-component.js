'use strict';


(function () {

  const { reactive, computed, effect } = VueReactivity;

  const ASYNC = 'app-async';

  const Async = rcg.defineComponent(ASYNC, (ctx, emit, props) => {

    let element;
    let controller = null;
    let timerId = null;
    let currentUrl = '';

    const state = reactive({
      status: 'idle',
      html: '',
      error: null
    });

    const isLoading = computed(() => state.status === 'loading');
    const isSuccess = computed(() => state.status === 'success');
    const hasError = computed(() => state.status === 'error');
    const loadingText = computed(() => props.loading ?? 'Cargando...');
    const errorText = computed(() => state.error?.message ?? props.error ?? 'No se pudo cargar el contenido.');

    const hydrateLoadedContent = () => {
      const content = element?.querySelector('[data-async-content]');
      if (!content) return;
      rcg.hydrate(content, {...ctx, ...handlers});
    };

    const setError = (error) => {
      state.status = 'error';
      state.error = error;
      state.html = '';
    };

    const load = async (requestUrl = currentUrl) => {

      if (!requestUrl) {
        setError(new Error('app-async requiere la prop "url".'));
        return;
      }
      if (controller) controller.abort();
      controller = new AbortController();
      const localController = controller;

      state.status = 'loading';
      state.error = null;

      try {
        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'text/html'
          },
          credentials: 'same-origin',
          signal: localController.signal
        });

        if (response.ok){
          const html = await response.text();
          if (currentUrl !== requestUrl) return;
          state.status = 'success';
          state.html = html;
          queueMicrotask(hydrateLoadedContent);
          return;
        }
        throw new Error(`Error HTTP ${response.status}: ${response.statusText} ${requestUrl}`);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setError(error);
      }
    };

    const invokeLoad = (currentUrl) => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (controller) controller.abort();

      state.status = 'loading';
      state.error = null;
      state.html = '';
      timerId = setTimeout(() => {
        timerId = null;
        load(currentUrl);
      }, props.delay ?? 0);
    };

    const handlers = {
      retry() {
        invokeLoad(currentUrl);
      }
    };

    const template = `
      <div class="flex flex-col text-center">
        <div data-if="isLoading">    
          <div data-component="app-spinner" [size]="md" [label]="loadingText"></div>     
        </div>
        <div data-if="isSuccess" data-bind="html:state.html" data-async-content></div>
        <div
          data-if="hasError"
          class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p class="font-semibold">
            Error al cargar el contenido
          </p>
          <p class="mt-1" data-bind="errorText"></p>
          <button
            type="button"
            class="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            on-click="retry">
            Reintentar
          </button>
        </div>            
      </div>
    `;

    effect(() => {
      const nextUrl = String(props.url ?? '').trim();
      if (nextUrl === currentUrl) return;
      currentUrl = nextUrl;
      invokeLoad(currentUrl);
    });

    return {
      elementCreated: (e) => element = e,
      template,
      handlers,
      ctx: {
        state,
        isLoading,
        isSuccess,
        hasError,
        loadingText,
        errorText
      }
    };

  });

  rcg.registerComponent(ASYNC, Async);

}());
