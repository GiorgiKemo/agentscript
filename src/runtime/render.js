import { decodeProgram } from "../compiler/bytecode.js";

const CONTAINER_KINDS = new Set(["navbar", "hero", "main", "section", "footer", "row", "column"]);
const NONE_INDEX = 65535;
const CONDITIONAL_ACTIONS = new Set([
  "if-state-equals-literal",
  "if-state-not-equals-literal",
  "if-state-greater-than-literal",
  "if-state-less-than-literal",
  "if-state-equals-state",
  "if-state-not-equals-state",
  "if-state-greater-than-state",
  "if-state-less-than-state"
]);

const DEFAULT_STYLES = {
  navbar: { direction: "row", gap: 12, paddingX: 18, paddingY: 12 },
  hero: { direction: "column", gap: 20, paddingX: 26, paddingY: 26 },
  main: { direction: "column", gap: 24, paddingX: 24, paddingY: 24 },
  section: { direction: "column", gap: 18, paddingX: 18, paddingY: 18 },
  footer: { direction: "row", gap: 12, paddingX: 18, paddingY: 16 },
  row: { direction: "row", gap: 12 },
  column: { direction: "column", gap: 12 },
  button: { fontSize: 16, width: 160, height: 44, radius: 12, paddingX: 18, paddingY: 10 },
  heading: { fontSize: 48 },
  text: { fontSize: 18 },
  field: { fontSize: 16, width: 320, height: 46, radius: 14, paddingX: 14, paddingY: 10 }
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildTree(nodes, pageName) {
  const root = {
    kind: "page",
    id: "page",
    text: "",
    pageName,
    children: [],
    styles: {},
    runtimeStyles: {}
  };

  const builtNodes = nodes.map((node) => ({
    ...node,
    children: [],
    styles: {},
    runtimeStyles: {}
  }));

  builtNodes.forEach((node) => {
    if (node.parentIndex === NONE_INDEX) {
      root.children.push(node);
      return;
    }

    builtNodes[node.parentIndex].children.push(node);
  });

  function connectParents(node, parent = null) {
    node.parent = parent;
    for (const child of node.children) {
      connectParents(child, node);
    }
  }

  connectParents(root);
  return { root, builtNodes };
}

function applyVisualDeclaration(node, declaration) {
  const defaults = DEFAULT_STYLES[node.kind] ?? {};
  const styles = node.runtimeStyles;

  switch (declaration.name) {
    case "color":
      styles.color = declaration.values[0];
      break;
    case "background":
      styles.background = declaration.values[0];
      break;
    case "font-size":
      styles.fontSize = declaration.values[0];
      break;
    case "increase-font-size":
      styles.fontSize = (styles.fontSize ?? defaults.fontSize ?? 0) + declaration.values[0];
      break;
    case "width":
      styles.width = declaration.values[0];
      break;
    case "increase-width":
      styles.width = (styles.width ?? defaults.width ?? 0) + declaration.values[0];
      break;
    case "height":
      styles.height = declaration.values[0];
      break;
    case "increase-height":
      styles.height = (styles.height ?? defaults.height ?? 0) + declaration.values[0];
      break;
    case "gap":
      styles.gap = declaration.values[0];
      break;
    case "radius":
      styles.radius = declaration.values[0];
      break;
    case "padding":
      styles.paddingY = declaration.values[0];
      styles.paddingX = declaration.values[1];
      break;
    case "direction":
      styles.direction = declaration.values[0];
      break;
    case "align-items":
      styles.alignItems = declaration.values[0];
      break;
    case "justify-content":
      styles.justifyContent = declaration.values[0];
      break;
    case "center":
      if (CONTAINER_KINDS.has(node.kind)) {
        styles.alignItems = "center";
        styles.justifyContent = "center";
      } else {
        styles.centerSelf = true;
      }
      break;
    case "font-weight":
      styles.fontWeight = declaration.values[0];
      break;
    case "text-align":
      styles.textAlign = declaration.values[0];
      break;
    case "shadow":
      styles.shadow = declaration.values[0];
      break;
    case "grow":
      styles.grow = declaration.values[0];
      break;
    case "push-right":
      styles.pushRight = true;
      break;
    case "push-left":
      styles.pushLeft = true;
      break;
    case "hide":
      styles.hidden = true;
      break;
    case "show":
      styles.hidden = false;
      break;
    default:
      break;
  }
}

function toCssAlignment(value) {
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  if (value === "between") return "space-between";
  return value;
}

function toCssShadow(value) {
  if (value === "soft") return "0 12px 28px rgba(36, 62, 110, 0.12)";
  if (value === "medium") return "0 18px 40px rgba(36, 62, 110, 0.18)";
  if (value === "strong") return "0 28px 56px rgba(16, 38, 79, 0.24)";
  if (value === "none") return "none";
  return value;
}

function positionLinesForNode(node) {
  const styles = node.runtimeStyles;
  const lines = [];

  if (styles.pushRight) {
    lines.push("margin-left: auto;");
  }

  if (styles.pushLeft) {
    lines.push("margin-right: auto;");
  }

  if (!styles.centerSelf) {
    return lines;
  }

  if (node.parent && CONTAINER_KINDS.has(node.parent.kind)) {
    const parentDirection = node.parent.runtimeStyles.direction ?? "column";
    if (parentDirection === "row") {
      lines.push("margin-left: auto;", "margin-right: auto;", "align-self: center;");
      return [...new Set(lines)];
    }

    lines.push("align-self: center;", "margin-left: auto;", "margin-right: auto;");
    return [...new Set(lines)];
  }

  lines.push("display: block;", "margin-left: auto;", "margin-right: auto;");
  return [...new Set(lines)];
}

function moveChild(parent, fromIndex, toIndex) {
  if (!parent || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return;
  }

  const [item] = parent.children.splice(fromIndex, 1);
  parent.children.splice(toIndex, 0, item);
}

function applyReorder(node, declaration, builtNodes) {
  const targetParent = node.parent;
  const referenceNode = builtNodes[declaration.values[0]];

  if (!targetParent || !referenceNode || referenceNode.parent !== targetParent) {
    return;
  }

  const currentIndex = targetParent.children.findIndex((child) => child.id === node.id);
  const referenceIndex = targetParent.children.findIndex((child) => child.id === referenceNode.id);
  if (currentIndex === -1 || referenceIndex === -1) {
    return;
  }

  if (declaration.name === "switch-position") {
    [targetParent.children[currentIndex], targetParent.children[referenceIndex]] = [
      targetParent.children[referenceIndex],
      targetParent.children[currentIndex]
    ];
    return;
  }

  if (declaration.name === "move-before") {
    const adjustedIndex = currentIndex < referenceIndex ? referenceIndex - 1 : referenceIndex;
    moveChild(targetParent, currentIndex, adjustedIndex);
    return;
  }

  if (declaration.name === "move-after") {
    const adjustedIndex = currentIndex < referenceIndex ? referenceIndex : referenceIndex + 1;
    moveChild(targetParent, currentIndex, adjustedIndex);
  }
}

function applyRules(root, builtNodes, rules) {
  function seedDefaults(node) {
    node.runtimeStyles = { ...(DEFAULT_STYLES[node.kind] ?? {}) };
    for (const child of node.children) {
      seedDefaults(child);
    }
  }

  seedDefaults(root);

  for (const rule of rules) {
    const node = builtNodes[rule.targetIndex];
    if (!node) {
      continue;
    }

    for (const declaration of rule.declarations) {
      if (
        declaration.name === "move-before" ||
        declaration.name === "move-after" ||
        declaration.name === "switch-position"
      ) {
        applyReorder(node, declaration, builtNodes);
      } else {
        applyVisualDeclaration(node, declaration);
      }
    }
  }
}

function cssBlockForNode(node) {
  const styles = node.runtimeStyles;
  const lines = [];

  if (styles.color) lines.push(`color: ${styles.color};`);
  if (styles.background) lines.push(`background: ${styles.background};`);
  if (typeof styles.fontSize === "number") lines.push(`font-size: ${styles.fontSize}px;`);
  if (typeof styles.fontWeight === "number") lines.push(`font-weight: ${styles.fontWeight};`);
  if (styles.textAlign) lines.push(`text-align: ${styles.textAlign};`);
  if (styles.shadow) lines.push(`box-shadow: ${toCssShadow(styles.shadow)};`);
  if (typeof styles.width === "number") lines.push(`width: ${styles.width}px;`);
  if (typeof styles.height === "number") lines.push(`min-height: ${styles.height}px;`);
  if (typeof styles.grow === "number") lines.push(`flex-grow: ${styles.grow};`);
  if (typeof styles.gap === "number" && CONTAINER_KINDS.has(node.kind)) lines.push(`gap: ${styles.gap}px;`);
  if (typeof styles.radius === "number") lines.push(`border-radius: ${styles.radius}px;`);
  if (
    typeof styles.paddingY === "number" &&
    typeof styles.paddingX === "number" &&
    (CONTAINER_KINDS.has(node.kind) || node.kind === "button" || node.kind === "field")
  ) {
    lines.push(`padding: ${styles.paddingY}px ${styles.paddingX}px;`);
  }
  if (styles.direction && CONTAINER_KINDS.has(node.kind)) lines.push(`flex-direction: ${styles.direction};`);
  if (styles.alignItems && CONTAINER_KINDS.has(node.kind)) lines.push(`align-items: ${toCssAlignment(styles.alignItems)};`);
  if (styles.justifyContent && CONTAINER_KINDS.has(node.kind)) {
    lines.push(`justify-content: ${toCssAlignment(styles.justifyContent)};`);
  }
  lines.push(...positionLinesForNode(node));

  if (lines.length === 0) {
    return "";
  }

  return `[data-node-id="${node.id}"] {\n  ${lines.join("\n  ")}\n}`;
}

function collectNodeCss(root) {
  const blocks = [];

  function visit(node) {
    if (node.kind !== "page") {
      const block = cssBlockForNode(node);
      if (block) {
        blocks.push(block);
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(root);
  return blocks.join("\n\n");
}

function resolveNodeText(node, states) {
  if (node.bindingStateIndex !== NONE_INDEX) {
    return states[node.bindingStateIndex]?.initialValue ?? "";
  }

  return node.text ?? "";
}

function renderNode(node, states, clickableIds) {
  const className = `node node-${node.kind}`;
  const childrenHtml = node.children.map((child) => renderNode(child, states, clickableIds)).join("");
  const text = escapeHtml(resolveNodeText(node, states));
  const bindingAttribute =
    node.bindingStateIndex !== NONE_INDEX ? ` data-bind-state="${escapeHtml(states[node.bindingStateIndex]?.id ?? "")}"` : "";
  const clickAttribute = clickableIds.has(node.id) ? ` data-event-click="true"` : "";
  const hiddenAttribute = node.runtimeStyles.hidden ? " hidden" : "";

  switch (node.kind) {
    case "navbar":
      return `<nav class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</nav>`;
    case "hero":
      return `<section class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</section>`;
    case "main":
      return `<main class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</main>`;
    case "section":
      return `<section class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</section>`;
    case "footer":
      return `<footer class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</footer>`;
    case "row":
    case "column":
      return `<div class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${childrenHtml}</div>`;
    case "button":
      return `<button class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute} type="button">${text}</button>`;
    case "heading":
      return `<h1 class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${text}</h1>`;
    case "text":
      return `<p class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute}>${text}</p>`;
    case "field":
      return `<input class="${className}" data-node-id="${node.id}"${clickAttribute}${bindingAttribute}${hiddenAttribute} type="text" value="${text}">`;
    default:
      throw new Error(`Unsupported node kind "${node.kind}"`);
  }
}

function baseCss(pageName) {
  return `:root {
  color-scheme: light;
  font-family: "Segoe UI", Arial, sans-serif;
  background: #f3f6fb;
  color: #132238;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(89, 122, 255, 0.14), transparent 28rem),
    linear-gradient(180deg, #f7f9fc 0%, #eef3fb 100%);
  color: #132238;
}

.page-shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}

.page-shell::before {
  content: "${pageName}";
  display: block;
  margin-bottom: 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #5b708b;
}

.node-navbar,
.node-hero,
.node-main,
.node-section,
.node-footer,
.node-row,
.node-column {
  display: flex;
  width: 100%;
}

.node-navbar,
.node-footer {
  align-items: center;
  justify-content: flex-start;
  border: 1px solid rgba(40, 71, 122, 0.12);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  margin-bottom: 20px;
}

.node-hero,
.node-section,
.node-main {
  border: 1px solid rgba(40, 71, 122, 0.08);
  background: rgba(255, 255, 255, 0.88);
  border-radius: 28px;
  box-shadow: 0 18px 40px rgba(36, 62, 110, 0.08);
  margin-bottom: 20px;
}

.node-button {
  border: none;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #18314f;
  background: #dfe9ff;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.node-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(52, 88, 164, 0.16);
}

.node-field {
  border: 1px solid rgba(52, 88, 164, 0.18);
  outline: none;
  color: #17335b;
  background: white;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.node-field:focus {
  border-color: rgba(52, 88, 164, 0.58);
  box-shadow: 0 0 0 4px rgba(83, 119, 208, 0.12);
}

.node-heading {
  margin: 0;
  max-width: 12ch;
  line-height: 0.94;
  letter-spacing: -0.04em;
}

.node-text {
  margin: 0;
  max-width: 56ch;
  line-height: 1.6;
  color: #4f6683;
}`;
}

function toRuntimeAction(action, program) {
  if (action.name === "show-node" || action.name === "hide-node") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null
    };
  }

  if (action.name === "set-node-text-state") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null,
      sourceStateIndex: action.sourceStateIndex
    };
  }

  if (action.name === "set-node-text-literal") {
    return {
      name: action.name,
      targetNodeId: program.nodes[action.targetNodeIndex]?.id ?? null,
      value: action.value
    };
  }

  if (CONDITIONAL_ACTIONS.has(action.name)) {
    const runtimeAction = {
      name: action.name,
      targetStateIndex: action.targetStateIndex,
      actions: action.actions.map((childAction) => toRuntimeAction(childAction, program)),
      elseActions: action.elseActions.map((childAction) => toRuntimeAction(childAction, program))
    };

    if (action.name.endsWith("-state")) {
      runtimeAction.sourceStateIndex = action.sourceStateIndex;
    } else {
      runtimeAction.value = action.value;
    }

    return runtimeAction;
  }

  return action;
}

function generateRuntimeScript(program) {
  const bindings = program.nodes
    .map((node) => ({
      nodeId: node.id,
      bindingStateIndex: node.bindingStateIndex,
      kind: node.kind
    }))
    .filter((node) => node.bindingStateIndex !== NONE_INDEX);

  const runtimePayload = {
    states: program.states.map((state) => ({
      id: state.id,
      initialValue: state.initialValue
    })),
    bindings,
    nodes: program.nodes.map((node) => ({
      id: node.id
    })),
    handlers: program.handlers.map((handler) => ({
      eventName: handler.eventName,
      targetId: program.nodes[handler.targetIndex]?.id ?? null,
      actions: handler.actions.map((action) => toRuntimeAction(action, program))
    }))
  };
  const conditionalActionNames = JSON.stringify([...CONDITIONAL_ACTIONS]);

  return `const CONDITIONAL_ACTIONS = new Set(${conditionalActionNames});
const runtime = ${JSON.stringify(runtimePayload, null, 2)};

  const stateValues = runtime.states.map((state) => state.initialValue);
  const nodeElements = new Map(
    runtime.nodes.map((node) => [node.id, document.querySelector(\`[data-node-id="\${node.id}"]\`)])
  );
  const bindingNodes = runtime.bindings.map((binding) => ({
    ...binding,
    element: nodeElements.get(binding.nodeId)
  }));
  const bindingByNodeId = new Map(bindingNodes.map((binding) => [binding.nodeId, binding]));

function renderBindings() {
  for (const binding of bindingNodes) {
    if (!binding.element) {
      continue;
    }

    const value = stateValues[binding.bindingStateIndex];
    if (binding.kind === "field") {
      if (binding.element.value !== String(value)) {
        binding.element.value = String(value);
      }
      continue;
    }

    binding.element.textContent = String(value);
  }
}

function conditionMatches(action) {
  const targetValue = stateValues[action.targetStateIndex];
  const sourceValue = action.name.endsWith("-state") ? stateValues[action.sourceStateIndex] : action.value;

  if (action.name === "if-state-equals-literal") {
    return targetValue === action.value;
  }

  if (action.name === "if-state-not-equals-literal") {
    return targetValue !== action.value;
  }

  if (action.name === "if-state-greater-than-literal") {
    return targetValue > action.value;
  }

  if (action.name === "if-state-less-than-literal") {
    return targetValue < action.value;
  }

  if (action.name === "if-state-equals-state") {
    return targetValue === sourceValue;
  }

  if (action.name === "if-state-not-equals-state") {
    return targetValue !== sourceValue;
  }

  if (action.name === "if-state-greater-than-state") {
    return targetValue > sourceValue;
  }

  if (action.name === "if-state-less-than-state") {
    return targetValue < sourceValue;
  }

  return false;
}

function applyActions(actions) {
  for (const action of actions) {
    applyAction(action);
  }
}

function applyAction(action) {
  if (CONDITIONAL_ACTIONS.has(action.name)) {
    if (conditionMatches(action)) {
      applyActions(action.actions);
    } else {
      applyActions(action.elseActions);
    }
    return;
  }

  if (action.name === "show-node") {
    const element = nodeElements.get(action.targetNodeId);
    if (element) {
      element.hidden = false;
    }
    return;
  }

  if (action.name === "hide-node") {
    const element = nodeElements.get(action.targetNodeId);
    if (element) {
      element.hidden = true;
    }
    return;
  }

  if (action.name === "set-node-text-literal") {
    const element = nodeElements.get(action.targetNodeId);
    if (element) {
      element.textContent = String(action.value);
    }
    return;
  }

  if (action.name === "set-node-text-state") {
    const element = nodeElements.get(action.targetNodeId);
    if (element) {
      element.textContent = String(stateValues[action.sourceStateIndex]);
    }
    return;
  }

  if (action.name === "set-literal") {
    stateValues[action.targetStateIndex] = action.value;
    return;
  }

  if (action.name === "reset-state") {
    stateValues[action.targetStateIndex] = runtime.states[action.targetStateIndex]?.initialValue ?? "";
    return;
  }

  if (action.name === "set-state") {
    stateValues[action.targetStateIndex] = stateValues[action.sourceStateIndex];
    return;
  }

  if (action.name === "increase") {
    stateValues[action.targetStateIndex] += action.amount;
    return;
  }

  if (action.name === "decrease") {
    stateValues[action.targetStateIndex] -= action.amount;
  }
}

for (const binding of bindingNodes) {
  if (binding.kind !== "field" || !binding.element) {
    continue;
  }

  binding.element.addEventListener("input", () => {
    stateValues[binding.bindingStateIndex] = binding.element.value;
    renderBindings();
  });
}

for (const handler of runtime.handlers) {
  if (!handler.targetId) {
    continue;
  }

  const target = document.querySelector(\`[data-node-id="\${handler.targetId}"]\`);
  if (!target) {
    continue;
  }

  target.addEventListener(handler.eventName, () => {
    if (handler.eventName === "input") {
      const binding = bindingByNodeId.get(handler.targetId);
      if (binding?.kind === "field" && binding.element) {
        stateValues[binding.bindingStateIndex] = binding.element.value;
      }
    }

    applyActions(handler.actions);
    renderBindings();
  });
}

renderBindings();
`;
}

export function renderProgram(buffer) {
  const program = decodeProgram(buffer);
  const { root, builtNodes } = buildTree(program.nodes, program.pageName);
  applyRules(root, builtNodes, program.rules);

  const clickableIds = new Set(
    program.handlers
      .filter((handler) => handler.eventName === "click")
      .map((handler) => program.nodes[handler.targetIndex]?.id)
      .filter(Boolean)
  );

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(program.pageName)}</title>
    <link rel="stylesheet" href="./app.css">
  </head>
  <body>
    <div class="page-shell">
      ${root.children.map((node) => renderNode(node, program.states, clickableIds)).join("\n      ")}
    </div>
    <script type="module" src="./app.js"></script>
  </body>
</html>`;

  const css = `${baseCss(program.pageName)}\n\n${collectNodeCss(root)}`.trim();
  const js = generateRuntimeScript(program);
  return { html, css, js, program };
}
