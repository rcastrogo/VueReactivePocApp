'use strict';

(function () {

	const { reactive, computed } = VueReactivity;

	// ==========================================================
	// Accordion
	// ==========================================================
	const ACCORDION = 'app-accordion';

	const Accordion = rcg.defineComponent(ACCORDION, (ctx, emit, props) => {

		const state = reactive({
			open: false
		});

		const icon = computed(() => state.open ? '-' : '+');
		const handlers = {
			toggle() {
				state.open = !state.open;
			}
		};

		const template = `
      <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header
          class="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50"
          on-click="toggle">
          <div>
            <h3
              class="font-bold text-slate-900"
              data-bind="props.title | fallback:Accordion">
            </h3>
          </div>
          <span
            class="text-2xl font-bold text-slate-500"
            data-bind="icon">
          </span>
        </header>
        <div
          class="border-t border-slate-200 p-4"
          data-bind="show:state.open">
          <p class="text-sm leading-relaxed text-slate-600">
            <span data-bind="props.content | fallback:Lorem ipsum dolor sit amet, consectetur adipiscing elit."></span>
          </p>
        </div>
      </section>
    `;

		return {
			template,
			handlers,
			ctx: {
				state,
				icon
			}
		};

	});

	rcg.registerComponent(ACCORDION, Accordion);

	// ==========================================================
	// Alert
	// ==========================================================
	const ALERT = 'app-alert';

	const Alert = rcg.defineComponent(ALERT, (ctx, emit, props) => {

		const level = computed(() => {
			switch (props.type) {
				case 'success':
					return 'border-emerald-300 bg-emerald-50 text-emerald-800';
				case 'warning':
					return 'border-amber-300 bg-amber-50 text-amber-800';
				case 'danger':
					return 'border-red-300 bg-red-50 text-red-800';
				default:
					return 'border-sky-300 bg-sky-50 text-sky-800';
			}
		});

		const handlers = {
			close() {
				emit('close');
			}
		};

		const template = `
      <section
        class="rounded-xl border p-4 shadow-sm"
        data-bind="class:level">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3
              class="font-bold"
              data-bind="props.title | fallback:Alert">
            </h3>
            <p
              class="mt-2 text-sm"
              data-bind="props.message | fallback:No message">
            </p>
          </div>
          <button
            class="rounded-lg border px-3 py-1 text-sm"
            on-click="close">
            X
          </button>
        </div>
      </section>
    `;

		return {
			template,
			handlers,
			ctx: {
				level
			}
		};

	});

	rcg.registerComponent(ALERT, Alert);

	// ==========================================================
	// Progress
	// ==========================================================
	const PROGRESS = 'app-progress';

	const Progress = rcg.defineComponent(PROGRESS, (ctx, emit, props) => {

		const width = computed(() => `${props.value || 0}%`);
		const text = computed(() => `${props.value || 0}%`);

		const template = `
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-3 flex justify-between">
          <h3 class="font-bold text-slate-800">
            Progress
          </h3>
          <span
            class="text-sm text-slate-500"
            data-bind="text">
          </span>
        </div>
        <div class="h-3 rounded-full bg-slate-200">
          <div
            class="h-3 rounded-full bg-sky-500 transition-all duration-300"
						style="width:0"
            data-bind="style.width:width">
          </div>
        </div>
      </section>
    `;

		return {
			template,
			ctx: {
				width,
				text
			}
		};

	});

	rcg.registerComponent(PROGRESS, Progress);

	// ==========================================================
	// Rating
	// ==========================================================
	const RATING = 'app-rating';

	const Rating = rcg.defineComponent(RATING, (ctx, emit, props) => {

		const state = reactive({
			value: props.value || 0
		});

		const stars = computed(() => {
			return [1, 2, 3, 4, 5].map(v => ({
				value: v,
				active: v <= state.value,
				star: v <= state.value ? '★' : '☆'            
			}));
		});

		const handlers = {
			rate(e) {
				state.value = Number(e.arg[0]);
				emit('change', state.value);
			}
		};

		const template = `
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="mb-4 text-sm text-slate-500">
          Rating
        </p>
				<div class="flex gap-2" data-each="item in stars">
					 <button 
					  data-bind="text:item.star"
					 	on-click="rate:$item.value" 
						class="text-3xl">
					</button>
				</div>
        <p class="mt-4 text-sm text-slate-600">
          Selected:
          <span data-bind="state.value"></span>
        </p>
      </section>
    `;

		return {
			template,
			handlers,
			ctx: {
				state,
				stars
			}
		};

	});

	rcg.registerComponent(RATING, Rating);

	// ==========================================================
	// Stat Card
	// ==========================================================
	const STAT = 'app-stat';

	const Stat = rcg.defineComponent(STAT, (ctx, emit, props) => {

		const trend = computed(() => {
			return Number(props.delta || 0) >= 0 ? '▲' : '▼';
		});

		const template = `
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p
          class="text-xs tracking-[0.18em] text-slate-500"
          data-bind="props.label | fallback:Metric">
        </p>
        <h2
          class="mt-2 text-4xl font-bold"
          data-bind="props.value | fallback:0">
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          <span data-bind="trend"></span>
          <span data-bind="props.delta | fallback:0"></span>
          %
        </p>
				<div
          data-component="app-progress"
          [value]="props.value">
        </div>
      </section>
    `;

		return {
			template,
			ctx: {
				trend
			}
		};

	});

	rcg.registerComponent(STAT, Stat);

})();