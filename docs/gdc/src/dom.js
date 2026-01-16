export const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`[dom] Missing element id="${id}"`);
    return el;
};
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
