
'use strict';

const rcg = (function () {

  const { reactive, effect, computed, isRef, shallowRef } = VueReactivity;

  const isString = (val) => typeof val === 'string' || val instanceof String;
  const isFunction = (val) => val && typeof val === 'function';

  const pipes = {
    upper: (val) => isString(val) ? val.toUpperCase() : val,
    lower: (val) => isString(val) ? val.toLowerCase() : val,
    fallback: (val, arg) => (val === undefined || val === null || val === '') ? arg : val,
    prefix: (val, arg = '') => `${arg}${val}`,
    sufix: (val, arg = '') => `${val}${arg}`,
    debug: (val, arg) => {
      console.log(val, arg);
      return val;
    },
    formatMiliseconds: (val) => {
      const seconds = Number(val) / 1000;
      return `${seconds.toFixed(1)} segundos`
    },
    toNumber: (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    toFixed: (val, arg = 0)=> Number(val || 0).toFixed(arg),     
    toString: (val) => val?.toString() ?? '',
    toJSON: (val, arg = 2) => JSON.stringify(val, null, ~~arg),
    parseJSON: (val) => {
      try {
        return JSON.parse(val);
      } catch (e) {
        console.error("Error parseando JSON:", e);
        return null;
      }
    },
    value: (val, arg) => val?.[arg],
    equal: (val, arg) => String(val) === String(arg),
    not: (val) => val ? false : true,    
    join: (val, arg) => Array.isArray(val) ? val.join(arg) : '',
    includes: (val, arg) => {
      if (isString(val)) return val.includes(arg);
      if (Array.isArray(val)) return val.includes(arg);
      return false;
    },
    length: (val) => {
      if (isString(val) || Array.isArray(val)) return val.length;
      if (val && typeof val === 'object') return Object.keys(val).length;
      return 0;
    },
    if: (val, arg) => {
      const [truthy, falsy = ""] = arg.split(":");
      return (!val || val === 'false' || val === '0') ? falsy : truthy;
    },
    map: (val, arg) => {
      if (!arg) return val ?? '';   
      const mapping = Object.fromEntries(
        arg.split(',').map(pair => {
          const [key, value] = pair.split('=');
          return [key?.trim(), value?.trim()];
        })
      );
      return mapping[val] ?? val ?? '';
    },
    safeHTML: (text) => safeInnerHTML(text),
    safeAttribute: (text) => safeAttribute(text)
  };

  const actions = {
    text: (el, value) => el.textContent = value,
    html: (el, value) => el.innerHTML = value,
    class: (el, value) => el.className = value ?? '',
    show: (el, value) => el.style.display = value ? '' : 'none', // Visibility toggle
    attr: (el, value, prop) => {                                 // attr.href, attr.disabled
      if (value === false || value === null) el.removeAttribute(prop);
      else el.setAttribute(prop, value === true ? '' : value);
    },
    style: (el, value, prop) => el.style[prop] = value // style.color, style.backgroundColor
  };

  function parseBinding(binding) {
    // Split base expression and pipes, preserving literal || in expressions.
    const parts = binding.split(/(?<!\|)\|(?!\|)/);
    const baseExpr = parts[0].trim();
    const rawPipes = parts.slice(1);
    let action = 'text';
    let path = baseExpr;
    const firstColonIdx = baseExpr.indexOf(':');
    if (firstColonIdx !== -1) {
      action = baseExpr.slice(0, firstColonIdx).trim();
      path = baseExpr.slice(firstColonIdx + 1).trim();
    }
    const [actionName, prop] = action.split('.');
    return {
      action: actionName,
      path,
      pipes: parsePipes(rawPipes),
      prop
    };
  }

  function dataBind(el, context) {
    const rawBind = el.getAttribute('data-bind');
    if (!rawBind) return;
    el.removeAttribute('data-bind');
    const bindings = rawBind.split(';').map(d => d.trim()).filter(Boolean);

    bindings.forEach(binding => {
      const cfg = parseBinding(binding);
      effect(() => {

        if (cfg.action === 'invoke') {
          const [handlerName, ...eventArgs] = cfg.path.split(':');
          const resolvedArgs = resolveArgs(eventArgs, context);
          const actionHandler = actions[handlerName];
          if (actionHandler)
            actionHandler(el, context, resolvedArgs);
          else
            console.error(
              `Action handler "${handlerName}" not found for invoke directive.`
            );
          return;
        }

        let value = resolve(cfg.path, context);
        if (cfg.action === 'class')
          value = value === undefined
            ? parseClassName(cfg.path, context)
            : parseClassName(value, context);

        value = cfg.pipes.apply(value);

        const actionHandler = actions[cfg.action];
        if (actionHandler)
          actionHandler(el, value, cfg.prop);
        else
          el[cfg.action] = value;
      });
    });
  }

  function parsePipes(value) {
    const parsed = value.map(p => {
      const pipeStr = p.trim();
      const pipeColonIdx = pipeStr.indexOf(':');
      // If there's a colon, separate name and argument. 
      // We use slice to allow multiple colons in the argument (e.g., time:12:00)
      if (pipeColonIdx !== -1) {
        return {
          name: pipeStr.slice(0, pipeColonIdx).trim(),
          arg: pipeStr.slice(pipeColonIdx + 1).trim()
        };
      }
      return { name: pipeStr, arg: undefined };
    });
    return {
      apply: (value) => {
        return parsed.reduce((currentVal, pipeDef) => {
          const pipeFunc = pipes[pipeDef.name];
          return pipeFunc ? pipeFunc(currentVal, pipeDef.arg) : currentVal;
        }, value);
      }
    }
  }

  function parseOperand(valRaw, ctx) {
    const val = valRaw.trim();
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null') return null;
    if (val === 'undefined') return undefined;
    // Literales de conjunto/array: (1, 2, '3')
    if (val.startsWith('(') && val.endsWith(')')) {
      const inner = val.slice(1, -1).trim();
      if (!inner) return [];
      // Parseamos cada elemento de forma recursiva
      return inner.split(',').map(item => parseOperand(item, ctx));
    }
    if (val !== '' && !isNaN(val)) return Number(val);
    if ((val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))) {
      return val.slice(1, -1);
    }
    return resolve(val, ctx);
  };

  // const CONDITION_OPERATORS = ['===', '!==', '>=', '<=', '==', '!=', '>', '<'];
  // const operator = CONDITION_OPERATORS.find((op) => target.includes(op));  
  const OPERATOR_REGEX = /\b(not in|inc|in)\b|===|!==|>=|<=|==|!=|>|</;
  function evaluateComparison(rawExpr, ctx) {
    const expr = (rawExpr || '').trim();
    if (!expr) return true;
    const negated = expr.startsWith('!');
    const target = (negated ? expr.slice(1) : expr).trim();
    if (!target) return false;

    const match = target.match(OPERATOR_REGEX);
    if (!match) {
      const result = Boolean(parseOperand(target, ctx));
      return negated ? !result : result;
    }

    const operator = match[0];
    const splitIndex = target.indexOf(operator);
    const leftRaw = target.slice(0, splitIndex);
    const rightRaw = target.slice(splitIndex + operator.length);
    const left = parseOperand(leftRaw, ctx);
    const right = parseOperand(rightRaw, ctx);

    let result;
    switch (operator) {
      case 'in':
      case 'inc':
        result = Array.isArray(right) ? right.includes(left) : false;
        break;
      case 'not in':
        result = Array.isArray(right) ? !right.includes(left) : true;
        break;
      case '===': result = left === right; break;
      case '!==': result = left !== right; break;
      case '==': result = left == right; break;
      case '!=': result = left != right; break;
      case '>': result = left > right; break;
      case '<': result = left < right; break;
      case '>=': result = left >= right; break;
      case '<=': result = left <= right; break;
      default: result = false;
    }
    return negated ? !result : result;
  };

  const evaluateCondition = (rawExpr, ctx) => {
    const expr = (rawExpr || '').trim();
    if (!expr) return true;
    const orParts = expr.split('||').filter(Boolean); // Separamos por OR.
    return orParts.some(orPart => {
      return orPart.split('&&')// Para cada grupo del OR, separamos por AND.
        .filter(Boolean)
        .every(andPart => evaluateComparison(andPart, ctx));
    });
  };

  function parseClassName(value, ctx) {
    if (typeof value !== 'string') return '';
    const classes = [];
    value.split(/\r?\n/)
      .map(part => part.trim())
      .filter(Boolean)
      .forEach((rule) => {
        const exprIdx = rule.lastIndexOf('?');
        const rawClass = (exprIdx === -1 ? rule : rule.slice(0, exprIdx)).trim();
        const rawExpr = exprIdx === -1 ? '' : rule.slice(exprIdx + 1).trim();
        const classText = rawClass.replace(/^['"]+|['"]+$/g, '').trim();
        if (!classText) return;
        if (!evaluateCondition(rawExpr, ctx)) return;
        classes.push(...classText.split(/\s+/).filter(Boolean));
      });
    return [...new Set(classes)].join(' ');
  }

  function parseDataEachDirective(el, ctx, attrValue, tasks) {
    el.removeAttribute('data-each');
    const [itemName, , ...listParts] = attrValue.split(' '); // "item in tasks"
    const dataSource = listParts.join(' ').trim();
    const children = [...el.children];
    el.replaceChildren();
    if (dataSource.startsWith('[') && dataSource.endsWith(']')) {
      try {
        const list = JSON.parse(dataSource.replace(/'/g, '"'));
        const task = { op: 'data-each', ctx, dataSource: list, el, reactive: false, children, itemName }
        tasks.push(task);
      } catch (e) {
        console.error("Error parseando array estático en data-each:", e);
      }
    } else {
      const task = { op: 'data-each', ctx, dataSource, el, reactive: true, children, itemName };
      tasks.push(task);
    }
  }

  function parseDataComponentDirective(el, ctx, attrValue, tasks) {

    const propsData = {};
    const eventsData = {};
    const hostDirectives = [];
    const children = [...el.children];
    // ====================================================
    // Extraer atributos [input] y (output)
    // ====================================================
    Array.from(el.attributes)
      .forEach(attr => {
        let match = attr.name.match(/^\[(.+)\]$/);
        if (match) {
          const propName = toCamelCase(match[1]);
          propsData[propName] = attr.value;
          el.removeAttribute(attr.name);
          return;
        }
        match = attr.name.match(/^\((.+)\)$/);
        if (match) {
          const eventName = toCamelCase(match[1]);
          eventsData[eventName] = attr.value;
          el.removeAttribute(attr.name);
          return;
        }
        if (attr.name.startsWith('on-')) {
          hostDirectives.push({
            name: attr.name,
            value: attr.value
          });
          el.removeAttribute(attr.name);
        }
      });
    const task = {
      op: 'data-component',
      ctx,
      el,
      attrValue,
      children,
      propsData,
      eventsData,
      hostDirectives
    }
    tasks.push(task);
  }

  function parseOnDirective(target, ctx, attrName, attrValue) {
    const eventName = attrName.replace('on-', '');
    const [handlerName, ...eventArgs] = attrValue.split(':');
    const handler = ctx[handlerName] ||
      ctx.handlers?.[handlerName] ||
      (() => console.log(attrName));

    if (typeof handler === 'function') {
      const resolvedArgs = resolveArgs(eventArgs, ctx);
      target.addEventListener(eventName, (e) => {
        handler.call(ctx, { el: target, ev: e, ...resolvedArgs });
      });
    }
  }

  function parseIfDirective(el, ctx, expression, tasks) {
    const template = el.cloneNode(true);
    template.removeAttribute('data-if');
    el.removeAttribute('data-if');
    tasks.push({
      op: 'data-if',
      el,
      ctx,
      expression,
      template
    });
  }

  function isComponent(target) {
    return target.hasAttribute('data-component');
  }

  function dispatchDirective(target, ctx, attr, tasks) {
    const attrName = attr.name;
    const attrValue = attr.value;
    if (attrName === 'data-if') {
      if (isComponent(target)) return;
      parseIfDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'data-each') {
      if (isComponent(target)) return;
      parseDataEachDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'data-component') {
      parseDataComponentDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'data-bind') {
      dataBind(target, ctx);
      return;
    }
    if (attrName === 'on-publish') {
      target.removeAttribute(attrName);
      return;
    }    
    if (attrName.startsWith('on-')) {
      if (isComponent(target)) return;
      target.removeAttribute(attrName);
      parseOnDirective(target, ctx, attrName, attrValue);      
    }
  }

  function hydrate(root = document, ctx) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el = root;
    const tasks = [];
    while (el) {
      Array.from(el.attributes || []).forEach(attr => {
        const target = el;
        dispatchDirective(target, ctx, attr, tasks);
      });
      el = walker.nextNode();
    }
    tasks.forEach((task) => {
      if (task.op === 'data-if') createConditional(task);
      else if (task.op === 'data-component') createComponent(task);
      else if (task.op === 'data-each') createRepeater(task);
    });
    return root;
  }

  function createConditional(task) {
    const { el, ctx, expression, template } = task;
    const parent = el.parentNode;
    if (!parent) return;

    const placeholder = document.createComment('if');
    parent.replaceChild(placeholder, el);

    let mountedNode = null;
    const renderConditional = () => {
      const visible = evaluateCondition(expression, ctx);
      if (visible) {
        if (!mountedNode || !mountedNode.isConnected) {
          const clone = template.cloneNode(true);
          mountedNode = hydrate(clone, ctx);
          placeholder.after(mountedNode);
        }
        return;
      }
      if (mountedNode?.isConnected) {
        mountedNode.remove();
      }
      mountedNode = null;
    };
    effect(renderConditional);
  }

  function createComponent(task) {
    const { el, children, attrValue: name, hostDirectives, ctx } = task;
    el.removeAttribute('data-component');
    const component = components[name];
    if (!component) {
      el.innerHTML = `data-component ${name} no encontrado`;
      return;
    }
    const componentElement = component(task);
    hostDirectives?.forEach((directive) => {
      parseOnDirective(componentElement, ctx, directive.name, directive.value);
    });
    el.replaceWith(componentElement);
  }

  function createRepeater(task) {
    const { el, children, itemName, ctx, reactive, dataSource } = task;
    const render = (items = []) => {
      el.replaceChildren();
      items.forEach((item, index) => {
        children.forEach(node => {
          const clone = node.cloneNode(true);
          el.appendChild(clone);
          const data = {};
          data[itemName] = item;
          hydrate(clone, {
            ...ctx,
            ...data,
            index,
            first: index === 0,
            last: index === items.length - 1,
            even: index % 2 === 0,
            odd: index % 2 !== 0
          });
        });
      });
    };
    if (reactive) {
      effect(() => render(resolve(dataSource, ctx)));
      return;
    }
    render(dataSource);
  }

  function resolve(path, ctx) {
    if (path.startsWith('?')) {
      const channel = resolve(path.slice(1), ctx);
      return rcg.bus.on(channel).value.payload;
    }
    let value = path.split('.').reduce((o, k) => o?.[k], ctx);
    return isRef(value) ? value.value : value;
  }

  function resolveArgs(eventArgs, ctx) {
    const resolved = eventArgs.map((a) => {
      if (a.startsWith('$'))
        return resolve(a.slice(1), ctx);
      return a;
    });
    return { arg: resolved, eventArgs };
  }

  function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  function onReady(fn) {
    if (typeof fn === 'function')
      document.addEventListener('DOMContentLoaded', fn);
  }

  function buildElement(html, options = {}, returnFirst = true) {
    const root = document.createElement('div');
    root.innerHTML = html;
    const target = returnFirst ? root.firstElementChild : root;
    Object.assign(target, options);
    return target;
  }

  function inheritHostAttributes(host, element) {
    if (host.id) {
      element.id = host.id;
      host.removeAttribute('id');
    }
    if (host.className)
      element.className = `${host.className} ${element.className}`.trim();
    if (host.style.cssText)
      element.style.cssText = [host.style.cssText, element.style.cssText].filter(Boolean).join(';');
  }

  function createPropsProxy(propsData, context) {
    const props = {};
    for (const [key, path] of Object.entries(propsData ?? {})) {
      Object.defineProperty(props, key, {
        enumerable: true,
        get() {
          const val = resolve(path, context)
          return val ?? path;
        }
      });
    }
    return props;
  }

  function createEmit(eventsData, context) {
    return function emit(eventName, detail = null) {
      const handlerStr = eventsData?.[eventName];
      if (!handlerStr) return;

      const [handlerName, ...eventArgs] = handlerStr.split(':');
      const handler = context[handlerName] || context.handlers?.[handlerName];

      if (typeof handler === 'function') {
        const resolvedArgs = resolveArgs(eventArgs, context);
        handler.call(context, { detail, ...resolvedArgs });
        return;
      }

      console.warn(`Handler "${handlerName}" no encontrado en el padre para el evento "${eventName}"`);
    };
  }

  function buildHydrationContext(baseContext, definition, props, emit, host, element, children) {
    return {
      ...definition.ctx,
      props,
      emit,
      // Solo se añadirán si existen, manteniendo el objeto limpio
      ...(definition.state !== undefined && { state: definition.state }),
      ...(definition.handlers !== undefined && { handlers: definition.handlers }),
      scope: baseContext,      
      element,
      host,
      children
    };
  }

  function defineComponent(name, setup) {
    return function component(opt) {
      const { propsData, eventsData, ctx: parentContext, children, el: hostElement } = opt;
      const props = createPropsProxy(propsData, parentContext);
      const emit = createEmit(eventsData, parentContext);
      const definition = setup(parentContext, emit, props) || {};
      const template = definition.template || '<div></div>';
      const element = isString(template) ? buildElement(template) : template;

      if(isFunction(definition.elementCreated)) definition.elementCreated?.(element);

      inheritHostAttributes(hostElement, element);

      const hydrationContext = buildHydrationContext(
        parentContext,
        definition,
        props,
        emit,
        hostElement,
        element,
        children
      );

      element.__instance = hydrationContext;
      if (name) element.setAttribute(name, '');

      return hydrate(element, hydrationContext);
    };
  }

  const components = {};
  function registerComponent(name, component) {
    components[name] = component;
  }

  class ReactiveBus {

    #channels = new Map();

    channel(name) {
      let channel = this.#channels.get(name);
      if (!channel) {
        channel = shallowRef({
          version: 0,
          payload: undefined
        });
        this.#channels.set(name, channel);
      }
      return channel;
    }

    emit(name, payload) {
      const channel = this.channel(name);
      channel.value = {
        version: channel.value.version + 1,
        payload
      };
    }

    clear(name) {
      if (!this.#channels.has(name)) return;
      const channel = this.#channels.get(name);
      channel.value = {
        version: channel.value.version + 1,
        payload: undefined
      };
    }

    delete(name) { this.#channels.delete(name); }
    has(name) { return this.#channels.has(name); }
    names() { return [...this.#channels.keys()]; }
    on(name) { return this.channel(name); }

  }

  function safeInnerHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function safeAttribute(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll("'", '&#39;');
  }

  const http = {

    async getHtml(url, options = {}) {
      if (!url) return 'Se requiere una URL.';
      const {
        signal,
        headers = {},
        credentials = 'same-origin'
      } = options;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html',
          ...headers
        },
        credentials,
        signal
      });
      if (!response.ok) throw new Error(`Error HTTP ${response.status}: ${response.statusText} ${url}`);
      return response.text();
    }

  };

  return {
    hydrate,
    onReady,
    defineComponent,
    registerComponent,
    buildElement,
    evaluateCondition,
    parseOperand,
    parsePipes,
    registerAction: (name, action) => actions[name] = action,
    registerPipe: (name, pipe) => pipes[name] = pipe,
    bus: new ReactiveBus(),
    http
  };

})();
