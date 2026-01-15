export const $ = (id) => document.getElementById(id);
export const qs = (sel, root = document) => (root ? root.querySelector(sel) : null);
