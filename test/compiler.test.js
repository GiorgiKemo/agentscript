import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSources, compileSources } from "../src/compiler/compile.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(currentDir, "..");
const layoutSource = fs.readFileSync(path.join(workspaceDir, "examples", "home.agent"), "utf8");
const styleSource = fs.readFileSync(path.join(workspaceDir, "examples", "home.style"), "utf8");

test("checkSources validates the example program", () => {
  const result = checkSources(layoutSource, styleSource);

  assert.equal(result.root.pageName, "Launch");
  assert.equal(result.nodes.length, 24);
  assert.equal(result.states.length, 3);
  assert.equal(result.handlers.length, 3);
  assert.equal(result.rules.length, 18);
  assert.equal(result.ir.states[0].id, "clicks");
  assert.equal(result.ir.nodes[8].bindingStateIndex, 2);
  assert.equal(result.ir.nodes[9].bindingStateIndex, 2);
  assert.equal(result.ir.nodes[10].bindingStateIndex, 0);
  assert.equal(result.ir.handlers[0].targetIndex, 14);
  assert.equal(result.ir.handlers[0].actions[0].targetStateIndex, 0);
  assert.equal(result.ir.handlers[1].targetIndex, 8);
  assert.equal(result.ir.handlers[2].targetIndex, 15);

  const countRule = result.rules.find((rule) => rule.targetId === "click_count");
  const startRule = result.rules.find((rule) => rule.targetId === "start");
  const detailRule = result.rules.find((rule) => rule.targetId === "detail");
  const actionsRule = result.rules.find((rule) => rule.targetId === "actions");
  const titleRule = result.rules.find((rule) => rule.targetId === "title");
  const fieldRule = result.rules.find((rule) => rule.targetId === "note_input");

  assert.deepEqual(
    countRule.declarations.map((declaration) => declaration.name),
    ["color", "increase-font-size", "font-weight"]
  );
  assert.deepEqual(
    fieldRule.declarations.map((declaration) => declaration.name),
    ["background", "color", "width", "height", "padding", "radius"]
  );
  assert.deepEqual(
    startRule.declarations.map((declaration) => declaration.name),
    ["background", "color", "padding", "increase-width", "increase-height", "grow"]
  );
  assert.deepEqual(
    detailRule.declarations.map((declaration) => declaration.name),
    ["hide", "background", "direction", "gap", "shadow"]
  );
  assert.deepEqual(
    actionsRule.declarations.map((declaration) => declaration.name),
    ["direction", "gap", "center"]
  );
  assert.deepEqual(
    titleRule.declarations.map((declaration) => declaration.name),
    ["increase-font-size", "text-align"]
  );
  assert.deepEqual(
    result.handlers[0].actions.map((action) => action.name),
    ["increase", "if-state-equals-literal", "if-state-greater-than-literal", "set-node-text-state", "show-node"]
  );
  assert.deepEqual(
    result.handlers[0].actions[1].actions.map((action) => action.name),
    ["set-literal", "set-node-text-literal"]
  );
  assert.deepEqual(
    result.handlers[0].actions[1].elseActions.map((action) => action.name),
    ["set-literal", "set-node-text-literal"]
  );
  assert.deepEqual(
    result.handlers[0].actions[2].actions.map((action) => action.name),
    ["set-node-text-literal"]
  );
  assert.deepEqual(
    result.handlers[0].actions[2].elseActions.map((action) => action.name),
    ["set-node-text-literal"]
  );
  assert.deepEqual(
    result.handlers[1].actions.map((action) => action.name),
    ["if-state-equals-literal"]
  );
  assert.deepEqual(
    result.handlers[1].actions[0].actions.map((action) => action.name),
    ["set-literal"]
  );
  assert.deepEqual(
    result.handlers[1].actions[0].elseActions.map((action) => action.name),
    ["set-literal"]
  );
  assert.deepEqual(
    result.handlers[2].actions.map((action) => action.name),
    ["reset-state", "reset-state", "set-node-text-literal", "set-node-text-literal", "hide-node"]
  );
});

test("compileSources emits bytecode and reordered HTML", () => {
  const result = compileSources(layoutSource, styleSource);

  assert.ok(result.bytecode.length > 0);
  assert.match(result.rendered.html, /<title>Launch<\/title>/);
  assert.match(result.rendered.html, /<script type="module" src="\.\/app\.js"><\/script>/);
  assert.match(result.rendered.html, /data-bind-state="clicks"/);
  assert.match(result.rendered.html, /data-node-id="note_input"/);
  assert.match(result.rendered.html, /type="text" value="Type a note for the panel"/);
  assert.match(result.rendered.html, /data-node-id="detail" hidden/);
  assert.match(result.rendered.js, /First click unlocked the panel/);
  assert.match(result.rendered.js, /const CONDITIONAL_ACTIONS = new Set/);
  assert.match(result.rendered.js, /handler\.eventName === "input"/);
  assert.match(result.rendered.js, /addEventListener\(handler\.eventName/);
  assert.match(result.rendered.js, /if-state-equals-literal/);
  assert.match(result.rendered.js, /if-state-greater-than-literal/);
  assert.match(result.rendered.js, /binding.kind === "field"/);
  assert.match(result.rendered.js, /addEventListener\("input"/);
  assert.match(result.rendered.js, /elseActions/);
  assert.match(result.rendered.js, /show-node/);
  assert.match(result.rendered.js, /hide-node/);
  assert.match(result.rendered.js, /reset-state/);
  assert.match(result.rendered.js, /set-node-text-literal/);
  assert.match(result.rendered.css, /\[data-node-id="actions"\][\s\S]*align-items: center;/);
  assert.match(result.rendered.css, /\[data-node-id="actions"\][\s\S]*justify-content: center;/);
  assert.match(result.rendered.css, /\[data-node-id="login"\][\s\S]*margin-left: auto;/);
  assert.match(result.rendered.css, /\[data-node-id="start"\][\s\S]*flex-grow: 1;/);
  assert.match(result.rendered.css, /\[data-node-id="foot"\][\s\S]*justify-content: space-between;/);
  assert.match(result.rendered.css, /\[data-node-id="detail"\][\s\S]*box-shadow:/);
  assert.match(result.rendered.css, /\[data-node-id="title"\][\s\S]*text-align: center;/);

  const featuresIndex = result.rendered.html.indexOf('data-node-id="features"');
  const loginIndex = result.rendered.html.indexOf('data-node-id="login"');
  const pricingIndex = result.rendered.html.indexOf('data-node-id="pricing"');
  const supportIndex = result.rendered.html.indexOf('data-node-id="support"');
  const docsIndex = result.rendered.html.indexOf('data-node-id="docs"');

  assert.ok(featuresIndex >= 0);
  assert.ok(loginIndex > featuresIndex);
  assert.ok(pricingIndex > loginIndex);
  assert.ok(docsIndex > supportIndex);
});

test("checkSources rejects unknown style references", () => {
  const invalidLayout = `page Broken

navbar {
  button home "Home"
}`;

  const invalidStyle = `select home {
  move after missing
}`;

  assert.throws(
    () => checkSources(invalidLayout, invalidStyle),
    /references unknown id "missing"/
  );
});

test("checkSources rejects handlers that target non-buttons", () => {
  const invalidLayout = `page Broken

state clicks 0

text label from clicks

when click label {
  increase clicks by 1
}`;

  assert.throws(
    () => checkSources(invalidLayout, ""),
    /click handlers currently require button targets/
  );
});

test("english-style size commands lower into canonical declarations", () => {
  const layout = `page Demo

button cta "Call To Action"`;

  const style = `select cta {
  size 180px 52px
  increase size by 10px
  increase text size by 4px
}`;

  const result = checkSources(layout, style);
  const rule = result.rules[0];

  assert.deepEqual(
    rule.declarations.map((declaration) => declaration.name),
    ["width", "height", "increase-width", "increase-height", "increase-font-size"]
  );
});

test("english-style layout and visual commands lower into canonical declarations", () => {
  const layout = `page Demo

row toolbar {
  button primary "Primary"
}`;

  const style = `select toolbar {
  arrange row
  space 18px
  center items
  justify between
}

select primary {
  fill midnightblue
  text color white
  round 18px
}`;

  const result = checkSources(layout, style);

  assert.deepEqual(
    result.rules[0].declarations.map((declaration) => declaration.name),
    ["direction", "gap", "align-items", "justify-content"]
  );
  assert.deepEqual(
    result.rules[1].declarations.map((declaration) => declaration.name),
    ["background", "color", "radius"]
  );
});

test("english-style positioning commands lower into canonical declarations", () => {
  const layout = `page Demo

row nav {
  button home "Home"
  button login "Login"
}

row actions {
  button primary "Primary"
  button secondary "Secondary"
}`;

  const style = `select nav {
  spread out
}

select login {
  push right
}

select primary {
  grow 2
}

select secondary {
  push left
}`;

  const result = compileSources(layout, style);

  assert.deepEqual(
    result.rules[0].declarations.map((declaration) => declaration.name),
    ["justify-content"]
  );
  assert.deepEqual(
    result.rules[1].declarations.map((declaration) => declaration.name),
    ["push-right"]
  );
  assert.deepEqual(
    result.rules[2].declarations.map((declaration) => declaration.name),
    ["grow"]
  );
  assert.deepEqual(
    result.rules[3].declarations.map((declaration) => declaration.name),
    ["push-left"]
  );
  assert.match(result.rendered.css, /\[data-node-id="nav"\][\s\S]*justify-content: space-between;/);
  assert.match(result.rendered.css, /\[data-node-id="login"\][\s\S]*margin-left: auto;/);
  assert.match(result.rendered.css, /\[data-node-id="primary"\][\s\S]*flex-grow: 2;/);
  assert.match(result.rendered.css, /\[data-node-id="secondary"\][\s\S]*margin-right: auto;/);
});

test("stack line-up bold center-text and shadow lower into canonical declarations", () => {
  const layout = `page Demo

section card {
  text title "Card"
}`;

  const style = `select card {
  stack
  shadow soft
}

select title {
  line up
  center text
  bold
}`;

  const result = checkSources(layout, style);

  assert.deepEqual(
    result.rules[0].declarations.map((declaration) => declaration.name),
    ["direction", "shadow"]
  );
  assert.deepEqual(
    result.rules[1].declarations.map((declaration) => declaration.name),
    ["direction", "text-align", "font-weight"]
  );
});

test("center command works for containers and individual nodes", () => {
  const layout = `page Demo

column stack {
  button cta "Go"
}`;

  const style = `select stack {
  center
}

select cta {
  center
}`;

  const result = compileSources(layout, style);

  assert.match(result.rendered.css, /\[data-node-id="stack"\][\s\S]*align-items: center;/);
  assert.match(result.rendered.css, /\[data-node-id="stack"\][\s\S]*justify-content: center;/);
  assert.match(result.rendered.css, /\[data-node-id="cta"\][\s\S]*align-self: center;/);
});

test("english-style visibility and text actions lower into canonical behavior", () => {
  const layout = `page Demo

state message "Ready"
state count 2

button open "Open"
text note "Closed"
section panel {
  text detail "Nothing yet"
}

when click open {
  change text of note to message
  change text of detail to "Opened"
  open panel
  close open
  reset count
}`;

  const style = `select panel {
  hide
}`;

  const result = checkSources(layout, style);

  assert.deepEqual(
    result.handlers[0].actions.map((action) => action.name),
    ["set-node-text-state", "set-node-text-literal", "show-node", "hide-node", "reset-state"]
  );
  assert.deepEqual(
    result.rules[0].declarations.map((declaration) => declaration.name),
    ["hide"]
  );
});

test("english-style conditional actions lower into canonical behavior", () => {
  const layout = `page Demo

state clicks 0
state limit 3

button pulse "Pulse"
text note "Waiting"

when click pulse {
  if clicks is greater than limit {
    change text of note to "Past limit"
  } else {
    change text of note to "Within limit"
  }
  if clicks is less than 2 {
    add 1 to clicks
  }
}`;

  const result = compileSources(layout, "");

  assert.deepEqual(
    result.handlers[0].actions.map((action) => action.name),
    ["if-state-greater-than-state", "if-state-less-than-literal"]
  );
  assert.deepEqual(
    result.handlers[0].actions[1].actions.map((action) => action.name),
    ["increase"]
  );
  assert.deepEqual(
    result.handlers[0].actions[0].actions.map((action) => action.name),
    ["set-node-text-literal"]
  );
  assert.deepEqual(
    result.handlers[0].actions[0].elseActions.map((action) => action.name),
    ["set-node-text-literal"]
  );
  assert.match(result.rendered.js, /if-state-greater-than-state/);
  assert.match(result.rendered.js, /if-state-less-than-literal/);
});

test("field nodes bind to text state", () => {
  const layout = `page Demo

state note "Ready"

field note_input from note
text note_preview from note`;

  const result = compileSources(layout, "");

  assert.equal(result.nodes[0].kind, "field");
  assert.equal(result.states[0].id, "note");
  assert.match(result.rendered.html, /<input class="node node-field"/);
  assert.match(result.rendered.html, /data-node-id="note_input"/);
  assert.match(result.rendered.js, /binding.kind === "field"/);
});

test("fields require bound text state", () => {
  const missingBinding = `page Demo

field note_input "Ready"`;

  assert.throws(
    () => checkSources(missingBinding, ""),
    /Field "note_input" must bind to a state/
  );

  const numberBinding = `page Demo

state count 0

field note_input from count`;

  assert.throws(
    () => checkSources(numberBinding, ""),
    /Field "note_input" currently requires a text state/
  );
});

test("input handlers require field targets", () => {
  const invalidLayout = `page Demo

state note "Ready"

button pulse "Pulse"

when input pulse {
  set note to "Changed"
}`;

  assert.throws(
    () => checkSources(invalidLayout, ""),
    /input handlers currently require field targets/
  );
});

test("numeric comparisons reject text states", () => {
  const layout = `page Demo

state status "ready"

button pulse "Pulse"

when click pulse {
  if status is greater than 1 {
    reset status
  }
}`;

  assert.throws(
    () => checkSources(layout, ""),
    /Numeric comparisons require a numeric state "status"/
  );
});

test("english-style state math commands lower into canonical behavior", () => {
  const layout = `page Demo

state clicks 4

button pulse "Pulse"

when click pulse {
  add 2 to clicks
  take 1 from clicks
}`;

  const result = checkSources(layout, "");

  assert.deepEqual(
    result.handlers[0].actions.map((action) => action.name),
    ["increase", "decrease"]
  );
  assert.deepEqual(
    result.handlers[0].actions.map((action) => action.amount),
    [2, 1]
  );
});
