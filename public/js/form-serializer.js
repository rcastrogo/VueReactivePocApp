
; (function (module) {

  const FIELD_SELECTOR = '[data-field]';
  const FIELD_ATTRIB = 'data-field';

  function parsePath(path) {
    if (typeof path !== 'string') return [];
    return path.split('.').map(part => part.trim()).filter(Boolean);
  }

  function getFields(target) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (target){
      if (target instanceof HTMLFormElement || target instanceof HTMLElement)
        return Array.from(target.querySelectorAll(FIELD_SELECTOR));
      return Array.from(target).filter(el => el.hasAttribute(FIELD_ATTRIB));
    }
    return [];
  }
  
  const isRadio = (f) => f && f.type === 'radio';
  const isCheckbox = (f) => f && f.type === 'checkbox';
  const isNumericField = (f) => f && ['number', 'range'].includes(f.type);
  const isCheckableField = (f) => isCheckbox(f) || isRadio(f);
  const hasExplicitCheckboxValue = (f) => isCheckbox(f) && f.hasAttribute('value') && f.value !== 'on';

  function getTargetElement(target) {
    if (typeof target === 'string') return document.querySelector(target);
    if (target instanceof HTMLFormElement || target instanceof HTMLElement) return target;
    return null;
  }

  const SKIP_VALUE = Symbol('SKIP_VALUE');
  function getFieldValue(f) {
    if (isCheckbox(f)) {
      if (hasExplicitCheckboxValue(f)) return f.checked ? f.value : SKIP_VALUE;
      return f.checked;
    }
    if (isRadio(f)) return f.checked ? f.value : SKIP_VALUE;
    if (isNumericField(f)) return f.value === '' ? null : Number(f.value);
    return f.value;
  }

  function setDeepProperty(obj, path, value) {
    const keys = parsePath(path);
    if (!keys.length) return;

    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    if (!(lastKey in current)) {
      current[lastKey] = value;
    } else if (!Array.isArray(current[lastKey])) {
      current[lastKey] = [current[lastKey], value];
    } else {
      current[lastKey].push(value);
    }
  }

  function getDeepProperty(obj, path) {
    return parsePath(path)
               .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
  }

  function hasDeepProperty(obj, path) {
    const keys = parsePath(path);
    if (!keys.length) return false;

    let current = obj;
    for (const key of keys) {
      if (current === null || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    return true;
  }

  function serialize(target) {
    const fields = getFields(target);
    const result = fields.reduce((acc, f) => {
      const key = f.getAttribute(FIELD_ATTRIB);
      if (!key) return acc;
      const value = getFieldValue(f);
      if (value === SKIP_VALUE) return acc;

      // if (!(key in acc)) {
      //   acc[key] = value;
      // } else if (!Array.isArray(acc[key])) {
      //   acc[key] = [acc[key], value];
      // } else {
      //   acc[key].push(value);
      // }
      setDeepProperty(acc, key, value);
      return acc;
    }, Object.create(null));

    fields.forEach(f => {
      const key = f.getAttribute(FIELD_ATTRIB);
      if (!key) return;
      if (!hasDeepProperty(result, key))
        setDeepProperty(result, key, '');
    });

    return result;
  }

  function apply(model = {}, target) {
    getFields(target).forEach(f => {
      const key = f.getAttribute(FIELD_ATTRIB);
      if (key && hasDeepProperty(model, key)){
        const value = getDeepProperty(model, key);
        if (isCheckbox(f)) {
          if (hasExplicitCheckboxValue(f)) {
            if (Array.isArray(value)) {
              f.checked = value.map(v => String(v)).includes(String(f.value));
            } else if (typeof value === 'boolean') {
              f.checked = value;
            } else {
              f.checked = String(value) === String(f.value);
            }
          } else {
            f.checked = parseBooleanValue(value);
          }
        }
        else if (isRadio(f))
          f.checked = f.value === String(value);
        else
          f.value = value ?? '';        
      }
    });
  }

  function parseBooleanValue(value){
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
    if (typeof value === 'string') {
      const normalized = value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (['true', '1', 'yes', 'y', 'si', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
    }
    return Boolean(value);
  }

  function appendQueryParam(params, key, value) {
    if (Array.isArray(value)) {
      value.forEach(item => appendQueryParam(params, key, item));
      return;
    }

    if (value === undefined || value === null) {
      params.append(key, '');
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        const composedKey = key ? `${key}.${nestedKey}` : nestedKey;
        appendQueryParam(params, composedKey, nestedValue);
      });
      return;
    }

    params.append(key, String(value));
  }

  function toQueryString(model = {}) {
    const params = new URLSearchParams();
    Object.entries(model).forEach(([key, value]) => {
      appendQueryParam(params, key, value);
    });
    return params.toString();
  }

  function clear(target) {
    getFields(target).forEach(f => {
      if (isCheckableField(f))
        f.checked = false;
      else if (f instanceof HTMLSelectElement)
        f.selectedIndex = -1;
      else
        f.value = '';
    });
  }

  function trackChanges(target, callback) {
    const targetElement = getTargetElement(target);
    if (!targetElement) return function unsubscribe() {};

    const lastValues = new Map();

    const handler = (event) => {
      const f = event.target.closest(FIELD_SELECTOR);
      if (f && targetElement.contains(f)) {
        const key = f.getAttribute(FIELD_ATTRIB);
        if (key) {
          const value = getFieldValue(f);
          if (value === SKIP_VALUE) return;
          if (lastValues.get(key) !== value) {
            lastValues.set(key, value);
            callback({ key, value });
          }
        }        
      }
    };

    targetElement.addEventListener('input', handler);
    targetElement.addEventListener('change', handler);
    return function unsubscribe() {
      targetElement.removeEventListener('input', handler);
      targetElement.removeEventListener('change', handler);
    };
  }

  module.formSerializer = {
    serialize,
    toQueryString,
    apply,
    clear,
    trackChanges
  };

}(rcg));
