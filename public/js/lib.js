
'use strict';

const rcg = (function () {

  const { reactive, effect, computed, isRef } = VueReactivity;

  const pipes = {
    upper: (val) => typeof val === 'string' ? val.toUpperCase() : val,
    lower: (val) => typeof val === 'string' ? val.toLowerCase() : val,
    fallback: (val, defaultVal) => (val === undefined || val === null || val === '') ? defaultVal : val,
    prefix: (val, pref) => `${pref}${val}`,
    debug: (val) => {
      console.log(val);
      return val;
    },
    formatMiliseconds: (val) => {
      const seconds = Number(val) / 1000;
      return `${seconds.toFixed(1)} segundos`
    }
  };

  const actions = {
    text: (el, value) => el.textContent = value,
    html: (el, value) => el.innerHTML = value,
    class: (el, value) => el.className = value ?? '',
    show: (el, value) => el.style.display = value ? '' : 'none', // Visibility toggle
    attr: (el, value, subTarget) => {                            // attr.href, attr.disabled
      if (value === false || value === null) el.removeAttribute(subTarget);
      else el.setAttribute(subTarget, value === true ? '' : value);
    },
    style: (el, value, subTarget) => el.style[subTarget] = value // style.color, style.backgroundColor
  };

  function dataBind(el, context) {
    const rawBind = el.getAttribute('data-bind');
    el.removeAttribute('data-bind');
    const declarations = rawBind.split(';').map(d => d.trim()).filter(Boolean);

    declarations.forEach(declaration => {
      // 1. Split the base expression from the pipes using "|"
      // This protects any ":" that might exist inside pipe arguments
      // const parts = declaration.split('|');
      const parts = declaration.split(/(?<!\|)\|(?!\|)/);
      const baseExpr = parts[0].trim();
      const rawPipes = parts.slice(1);
      // 2. Determine target and data path (defaulting to 'text' if no target is specified)
      let rawTarget = 'text';
      let dataPathStr = baseExpr;
      const firstColonIdx = baseExpr.indexOf(':');
      if (firstColonIdx !== -1) {
        rawTarget = baseExpr.slice(0, firstColonIdx).trim();
        dataPathStr = baseExpr.slice(firstColonIdx + 1).trim();
      }
      // 3. Parse sub-targets (e.g., "attr.href" -> targetName: "attr", subTarget: "href")
      const [targetName, subTarget] = rawTarget.split('.');
      // 4. Parse pipes safely
      const parsedPipes = rawPipes.map(p => {
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
      // 5. Create the reactive effect for THIS specific declaration
      effect(() => {
        // A. Navigate the context object to get the raw value
        let value = resolve(dataPathStr, context);
        if (targetName === 'class') {
          if (value === undefined) {
            value = parseClassName(dataPathStr, context);
          } else {
            value = parseClassName(value, context);
          }
        }
        // B. Apply the pipe chain in order
        value = parsedPipes.reduce((currentVal, pipeDef) => {
          const pipeFunc = pipes[pipeDef.name];
          return pipeFunc ? pipeFunc(currentVal, pipeDef.arg) : currentVal;
        }, value);
        // C. Execute the action on the DOM element
        const actionHandler = actions[targetName];
        if (actionHandler) {
          actionHandler(el, value, subTarget);
        } else {
          // Fallback: If not a predefined action, assign it as a native DOM property
          // Useful for input fields: "value: state.text"
          el[rawTarget] = value;
        }
      });
    });
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
    el.removeAttribute('data-component');

    const propsData = {};
    const eventsData = {};
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
        }
      });
    const task = {
      op: 'data-component',
      ctx,
      el,
      attrValue,
      children,
      propsData,
      eventsData
    }
    tasks.push(task);
  }

  function parseOnDirective(target, ctx, attrName, attrValue) {
    target.removeAttribute(attrName);
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

  function dispatchDirective(target, ctx, attr, tasks) {
    const attrName = attr.name;
    const attrValue = attr.value;
    if (attrName === 'data-if') {
      parseIfDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'data-each') {
      parseDataEachDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'data-component') {
      parseDataComponentDirective(target, ctx, attrValue, tasks);
      return;
    }
    if (attrName === 'on-publish') {
      target.removeAttribute(attrName);
      return;
    }
    if (attrName === 'data-bind') {
      dataBind(target, ctx);
      return;
    }
    if (attrName.startsWith('on-')) {
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
    const { el, children, attrValue: name } = task;
    const component = components[name];
    if (!component) {
      el.innerHTML = `data-component ${name} no encontrado`;
      return;
    }
    el.replaceWith(
      component(task)
    );
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
      scope: baseContext,
      ...definition.ctx,
      props,
      emit,
      // Solo se añadirán si existen, manteniendo el objeto limpio
      ...(definition.state !== undefined && { state: definition.state }),
      ...(definition.handlers !== undefined && { handlers: definition.handlers }),
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
      const element = typeof template === 'string' ? buildElement(template) : template;

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

  return {
    hydrate,
    onReady,
    defineComponent,
    registerComponent,
    buildElement,
    evaluateCondition,
    parseOperand
  };

})();
