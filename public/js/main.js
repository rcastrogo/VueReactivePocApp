const { reactive, effect, computed, isRef } = VueReactivity;

(function () {

  const COUNTER_COMPONENT_NAME = 'app-counter';
  const USERS_PANEL_COMPONENT_NAME = 'app-users-panel';

  const Counter = rcg.defineComponent(COUNTER_COMPONENT_NAME, (ctx, emit, props) => {

    const template = `
      <section class="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
        <header class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-[0.18em] text-slate-500">COMPONENTE</p>
            <h3 class="text-lg font-bold text-slate-900">Counter Lab</h3>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700" data-bind="par | upper"></span>
        </header>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-slate-100 p-3">
            <p class="text-xs text-slate-500">Local</p>
            <p class="text-3xl font-bold text-slate-900" data-bind="state.count"></p>
          </div>
          <div class="rounded-xl bg-amber-50 p-3">
            <p class="text-xs text-amber-700">Global</p>
            <p class="text-3xl font-bold text-amber-900" data-bind="scope.estado.cuenta"></p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <button on-click="dec" class="tool-bar-button border-slate-200">Restar</button>
          <button on-click="inc" class="tool-bar-button border-slate-200">Sumar</button>
          <button on-click="reset" class="tool-bar-button border-slate-200">Reset local</button>
          <button on-click="raiseEvent" class="tool-bar-button border-slate-200">Emit</button>
          <div data-bind="props.par">dd ddd</div>
        </div>
      </section>
    `;

    const state = reactive({
      count: 0
    });

    const handlers = {
      inc() {
        state.count++;
      },
      dec() {
        state.count--;
      },
      reset() {
        state.count = 0;
      },
      raiseEvent() {
        emit('info', state.count);
      }
    };

    return {
      template,
      ctx: { 
        state 
      },
      handlers
    };
  });

  const UsersPanel = rcg.defineComponent(USERS_PANEL_COMPONENT_NAME, (ctx, emit, props) => {

    const usersCount = computed(() => ctx.estado.users.length);
    const firstUser = computed(() => ctx.estado.users[0]?.name || 'Sin usuarios');
    const lastUser = computed(() => ctx.estado.users.at(-1)?.name || 'Sin usuarios');

    const template = `
      <section class="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
        <header class="flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold tracking-[0.18em] text-slate-500">NUEVO COMPONENTE</p>
            <h3 class="text-lg font-bold text-slate-900">User Snapshot</h3>
          </div>
          <button on-click="refreshUsers" class="tool-bar-button border-slate-200">Actualizar ahora</button>
        </header>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-100 p-3">
            <p class="text-xs text-slate-500">Activos</p>
            <p class="text-2xl font-bold text-slate-900" data-bind="usersCount"></p>
          </div>
          <div class="rounded-xl bg-sky-50 p-3">
            <p class="text-xs text-sky-700">Primero</p>
            <p class="font-semibold text-sky-900" data-bind="firstUser"></p>
          </div>
          <div class="rounded-xl bg-emerald-50 p-3">
            <p class="text-xs text-emerald-700">Ultimo</p>
            <p class="font-semibold text-emerald-900" data-bind="lastUser"></p>
          </div>
        </div>
      </section>
    `;

    const handlers = {
      refreshUsers() {
        ctx.refrescarUsuarios();
      }
    };

    return {
      template,
      handlers,
      ctx: {
        usersCount,
        firstUser,
        lastUser
      }
    };

  });

  rcg.registerComponent(COUNTER_COMPONENT_NAME, Counter);
  rcg.registerComponent(USERS_PANEL_COMPONENT_NAME, UsersPanel);

}());


const users = [
  { id: 1, name: 'Jose Martin' },
  { id: 2, name: 'Ana Lopez' },
  { id: 3, name: 'Pedro Garcia' },
  { id: 4, name: 'Laura Ruiz' },
  { id: 5, name: 'Carlos Perez' },
  { id: 6, name: 'Maria Sanchez' },
];
const REFRESH_TIME = 10_000;

const estado = reactive({
  cuenta: 0,
  limite: 12,
  loading: false,
  autoRefreshAt: REFRESH_TIME,
  users: []
});

function obtenerUsuariosAleatorios() {
  const cantidad = Math.floor(Math.random() * 3) + 3;
  const mezclados = [...users].sort(() => Math.random() - 0.5);
  return mezclados.slice(0, cantidad);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initAll() {

  const elContador = document.getElementById('contador');
  const userList = document.getElementById('user-list');

  const par = computed(() => estado.cuenta % 2 === 0 ? 'par' : 'impar');
  const mod3 = computed(() => estado.cuenta % 3 === 0);
  let refreshToken = 0;
  let nextAutoRefreshAt = Date.now() + REFRESH_TIME;

  const refrescarUsuarios = async () => {
    nextAutoRefreshAt = Date.now() + REFRESH_TIME;
    const token = ++refreshToken;
    estado.loading = true;

    const simulatedDelay = 1700 + Math.floor(Math.random() * 900);
    await sleep(simulatedDelay);

    if (token !== refreshToken) return;
    estado.users = obtenerUsuariosAleatorios();
    estado.loading = false;
  };

  const schedulerTick = async () => {
    const now = Date.now();
    estado.autoRefreshAt = Math.max(0, nextAutoRefreshAt - now);

    if (estado.loading || now < nextAutoRefreshAt) {
      return;
    }
    await refrescarUsuarios();
  };

  const handlers = {
    incrementCounter: function () {
      estado.cuenta++;
    },
    deleteUser: function (e) {
      const [id, index] = e.arg;
      console.log(id, index);
      estado.users = estado.users.filter((user) => user.id != id);
    },
    remove: function () {
      estado.cuenta = Math.max(0, estado.cuenta - 1);
    },
    refrescarUsuarios,
    showAlert(e) {
      const { detail, arg } = e;
      console.log(e);
      alert(detail || arg[0]);
    }
  }

  rcg.registerAction('action_01', (el, ctx, args) => {
    const extra = ctx.estado.cuenta;
    const count = ctx.estado.users.length;
    el.textContent = String(count) + ' usuarios / cuenta: ' + String(extra);
  })

  setInterval(() => {
    rcg.bus.emit('app-input/on-input', Math.random() * 100);
  }, 1_000);

  let messge_counter = 1;
  setInterval(() => {
    rcg.bus.emit('app-message', messge_counter++);
  }, 2_000);

  rcg.hydrate(document, { estado, par, mod3, ...handlers });

  effect(() => {
    userList.innerHTML = estado.users
      .map(user => `
        <li class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <span class="text-xs font-semibold text-slate-500">#${user.id}</span>
          <span class="font-medium text-slate-900">${user.name}</span>
        </li>
      `)
      .join('');
  });

  effect(() => {
    elContador.innerHTML = `${estado.cuenta} <br/> ${par.value}`;
    if(estado.cuenta === 15) refrescarUsuarios();
  });

  refrescarUsuarios();
  setInterval(schedulerTick, 200);

}

rcg.onReady(initAll);