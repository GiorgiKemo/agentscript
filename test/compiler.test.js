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

function collectActionNames(actions) {
  const names = [];

  function visit(list) {
    for (const action of list) {
      names.push(action.name);
      if (action.actions) {
        visit(action.actions);
      }
      if (action.elseActions) {
        visit(action.elseActions);
      }
    }
  }

  visit(actions);
  return names;
}

test("checkSources validates the example todo program", () => {
  const result = checkSources(layoutSource, styleSource);

  assert.equal(result.root.pageName, "Focus");
  assert.equal(result.nodes.length, 59);
  assert.equal(result.states.length, 12);
  assert.equal(result.handlers.length, 10);
  assert.equal(result.rules.length, 59);
  assert.equal(result.states[0].id, "draft");

  const draftField = result.nodes.find((node) => node.id === "draft_input");
  const firstTask = result.nodes.find((node) => node.id === "task_one");
  const completedValue = result.nodes.find((node) => node.id === "done_value");
  const addHandler = result.handlers.find((handler) => handler.targetId === "add_task");
  const doneHandler = result.handlers.find((handler) => handler.targetId === "done_one");
  const removeHandler = result.handlers.find((handler) => handler.targetId === "remove_one");
  const clearHandler = result.handlers.find((handler) => handler.targetId === "clear_all");
  const fieldRule = result.rules.find((rule) => rule.targetId === "draft_input");
  const itemRule = result.rules.find((rule) => rule.targetId === "item_one");
  const statusBoxRule = result.rules.find((rule) => rule.targetId === "status_box");
  const footRule = result.rules.find((rule) => rule.targetId === "foot");
  const titleRule = result.rules.find((rule) => rule.targetId === "title");
  const addHandlerNames = collectActionNames(addHandler.actions);
  const doneHandlerNames = collectActionNames(doneHandler.actions);
  const removeHandlerNames = collectActionNames(removeHandler.actions);
  const clearHandlerNames = collectActionNames(clearHandler.actions);

  assert.equal(draftField.kind, "field");
  assert.equal(draftField.textBinding, "draft");
  assert.equal(firstTask.textBinding, "slot1");
  assert.equal(completedValue.textBinding, "completed");
  assert.ok(addHandler);
  assert.ok(doneHandler);
  assert.ok(removeHandler);
  assert.ok(clearHandler);

  assert.deepEqual(
    fieldRule.declarations.map((declaration) => declaration.name),
    ["background", "color", "width", "height", "padding", "radius"]
  );
  assert.deepEqual(
    itemRule.declarations.map((declaration) => declaration.name),
    ["hide", "background", "direction", "align-items", "gap", "shadow", "radius"]
  );
  assert.deepEqual(
    statusBoxRule.declarations.map((declaration) => declaration.name),
    ["background", "shadow", "center", "radius", "grow"]
  );
  assert.deepEqual(
    footRule.declarations.map((declaration) => declaration.name),
    ["background", "color", "direction", "justify-content"]
  );
  assert.deepEqual(
    titleRule.declarations.map((declaration) => declaration.name),
    ["font-size", "color"]
  );

  assert.ok(addHandlerNames.includes("if-state-equals-literal"));
  assert.ok(addHandlerNames.includes("set-state"));
  assert.ok(addHandlerNames.includes("show-node"));
  assert.ok(addHandlerNames.includes("hide-node"));
  assert.ok(addHandlerNames.includes("increase"));
  assert.ok(addHandlerNames.includes("reset-state"));

  assert.ok(doneHandlerNames.includes("if-state-equals-literal"));
  assert.ok(doneHandlerNames.includes("set-literal"));
  assert.ok(doneHandlerNames.includes("show-node"));
  assert.ok(doneHandlerNames.includes("hide-node"));
  assert.ok(doneHandlerNames.includes("set-node-text-literal"));
  assert.ok(doneHandlerNames.includes("increase"));
  assert.ok(doneHandlerNames.includes("decrease"));

  assert.ok(removeHandlerNames.includes("if-state-equals-literal"));
  assert.ok(removeHandlerNames.includes("show-node"));
  assert.ok(removeHandlerNames.includes("hide-node"));
  assert.ok(removeHandlerNames.includes("decrease"));
  assert.ok(removeHandlerNames.includes("reset-state"));

  assert.ok(clearHandlerNames.includes("reset-state"));
  assert.ok(clearHandlerNames.includes("set-node-text-literal"));
  assert.ok(clearHandlerNames.includes("hide-node"));
  assert.ok(clearHandlerNames.includes("show-node"));
});

test("compileSources emits bytecode and todo app assets", () => {
  const result = compileSources(layoutSource, styleSource);

  assert.ok(result.bytecode.length > 0);
  assert.match(result.rendered.html, /<title>Focus<\/title>/);
  assert.match(result.rendered.html, /<script type="module" src="\.\/app\.js"><\/script>/);
  assert.match(result.rendered.html, /data-bind-state="draft"/);
  assert.match(result.rendered.html, /data-bind-state="slot1"/);
  assert.match(result.rendered.html, /data-bind-state="completed"/);
  assert.match(result.rendered.html, /data-node-id="draft_input"/);
  assert.match(result.rendered.html, /data-node-id="item_one" hidden/);
  assert.match(result.rendered.html, /data-node-id="badge_one" hidden/);
  assert.match(result.rendered.html, /data-node-id="draft_input"[^>]*value=""/);
  assert.match(result.rendered.js, /Task one completed/);
  assert.match(result.rendered.js, /List full\. Remove a task before adding another/);
  assert.match(result.rendered.js, /const CONDITIONAL_ACTIONS = new Set/);
  assert.match(result.rendered.js, /addEventListener\(handler\.eventName/);
  assert.match(result.rendered.js, /binding.kind === "field"/);
  assert.match(result.rendered.js, /addEventListener\("input"/);
  assert.match(result.rendered.js, /elseActions/);
  assert.match(result.rendered.js, /set-state/);
  assert.match(result.rendered.js, /show-node/);
  assert.match(result.rendered.js, /hide-node/);
  assert.match(result.rendered.js, /reset-state/);
  assert.match(result.rendered.js, /set-node-text-literal/);
  assert.match(result.rendered.css, /\[data-node-id="nav_note"\][\s\S]*margin-left: auto;/);
  assert.match(result.rendered.css, /\[data-node-id="status_box"\][\s\S]*align-items: center;/);
  assert.match(result.rendered.css, /\[data-node-id="status_box"\][\s\S]*justify-content: center;/);
  assert.match(result.rendered.css, /\[data-node-id="task_one"\][\s\S]*flex-grow: 1;/);
  assert.match(result.rendered.css, /\[data-node-id="item_one_actions"\][\s\S]*margin-left: auto;/);
  assert.match(result.rendered.css, /\[data-node-id="foot"\][\s\S]*justify-content: space-between;/);
  assert.match(result.rendered.css, /\[data-node-id="item_one"\][\s\S]*box-shadow:/);
  assert.match(result.rendered.css, /\[data-node-id="title"\][\s\S]*font-size: 56px;/);
  assert.match(result.rendered.css, /\[hidden\]\s*\{[\s\S]*display: none !important;/);
});

test("app syntax compiles multi-page navigation and page styles", () => {
  const layout = `app Demo

start page home

state message "Welcome"

create page home {
  section hero_box {
    heading title "Home"
    text hero_note from message
    button open_about "About"
  }
}

create page about {
  section about_box {
    heading about_title "About"
    text about_note "Built from one code file"
    button go_home "Back"
  }
}

when click open_about {
  go to page about
}

when click go_home {
  go to page home
}`;

  const style = `select page home {
  gap 28px
}

select page about {
  fill #f5f1e8
  padding 24px 24px
}

select hero_box {
  fill white
  round 24px
}`;

  const result = compileSources(layout, style);

  assert.equal(result.pages.length, 2);
  assert.equal(result.startPageId, "home");
  assert.equal(result.ir.pages[0].id, "home");
  assert.equal(result.ir.pages[1].id, "about");
  assert.equal(result.ir.startPageIndex, 0);
  assert.equal(result.nodes.find((node) => node.id === "about_title").pageIndex, 1);
  assert.deepEqual(
    result.handlers.map((handler) => handler.actions[0].name),
    ["go-to-page", "go-to-page"]
  );
  assert.match(result.rendered.html, /data-page-id="home"/);
  assert.match(result.rendered.html, /data-page-id="about" hidden/);
  assert.match(result.rendered.js, /currentPageIndex = action\.targetPageIndex/);
  assert.match(result.rendered.js, /data-page-id/);
  assert.match(result.rendered.js, /go-to-page/);
  assert.match(result.rendered.css, /\[data-page-id="home"\][\s\S]*gap: 28px;/);
  assert.match(result.rendered.css, /\[data-page-id="about"\][\s\S]*background: #f5f1e8;/);
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

test("safe text defaults keep content inside surfaced containers", () => {
  const layout = `page Demo

row card {
  text label "Tasks"
  text value "0"
}`;

  const style = `select card {
  fill white
  shadow soft
  round 20px
}`;

  const result = compileSources(layout, style);

  assert.match(result.rendered.css, /\.node-row > \*[\s\S]*max-width: 100%;/);
  assert.match(result.rendered.css, /\.node-text[\s\S]*overflow-wrap: anywhere;/);
  assert.match(result.rendered.css, /\.node-text[\s\S]*word-break: break-word;/);
  assert.match(result.rendered.css, /\[data-node-id="card"\][\s\S]*padding: 10px 16px;/);
  assert.match(result.rendered.css, /\[data-node-id="card"\][\s\S]*overflow: hidden;/);
});

test("set free opt-out disables text safety constraints for a node", () => {
  const layout = `page Demo

text label "Very wide label"`;

  const style = `select label {
  fill white
  round 20px
  set free
}`;

  const result = compileSources(layout, style);

  assert.deepEqual(
    result.rules[0].declarations.map((declaration) => declaration.name),
    ["background", "radius", "free-content"]
  );
  assert.match(result.rendered.css, /\[data-node-id="label"\][\s\S]*max-width: none;/);
  assert.match(result.rendered.css, /\[data-node-id="label"\][\s\S]*white-space: nowrap;/);
  assert.doesNotMatch(result.rendered.css, /\[data-node-id="label"\][\s\S]*overflow: hidden;/);
});

test("pill radii use capped safe padding instead of exploding layout", () => {
  const layout = `page Demo

section pill {
  text badge "Done"
}`;

  const style = `select pill {
  fill #dff2e5
  round 999px
}`;

  const result = compileSources(layout, style);

  assert.match(result.rendered.css, /\[data-node-id="pill"\][\s\S]*padding: 18px 20px;/);
  assert.doesNotMatch(result.rendered.css, /\[data-node-id="pill"\][\s\S]*padding: 500px 800px;/);
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

test("boolean states and reusable blocks compile into deterministic instance ids", () => {
  const layout = `app Demo

state ready true

create block stat_card {
  section shell {
    heading title "Ready"
    text value from ready
    button toggle "Toggle"
  }
}

start page home

create page home {
  row board {
    use block stat_card as primary_card
    use block stat_card as backup_card
  }
}

when click primary_card__toggle {
  if ready is true {
    set ready to false
  } else {
    set ready to true
  }
}`;

  const style = `select primary_card {
  fill white
}

select backup_card__toggle {
  push right
}`;

  const result = compileSources(layout, style);
  const nodeIds = result.nodes.map((node) => node.id);
  const condition = result.handlers[0].actions[0];

  assert.equal(result.states[0].type, "boolean");
  assert.equal(result.states[0].initialValue, true);
  assert.deepEqual(nodeIds, [
    "board",
    "primary_card",
    "primary_card__title",
    "primary_card__value",
    "primary_card__toggle",
    "backup_card",
    "backup_card__title",
    "backup_card__value",
    "backup_card__toggle"
  ]);
  assert.equal(condition.name, "if-state-equals-literal");
  assert.equal(condition.value, true);
  assert.equal(condition.actions[0].name, "set-literal");
  assert.equal(condition.actions[0].value, false);
  assert.equal(condition.elseActions[0].name, "set-literal");
  assert.equal(condition.elseActions[0].value, true);
  assert.match(result.rendered.html, /data-node-id="primary_card__toggle"/);
  assert.match(result.rendered.html, /data-node-id="backup_card__toggle"/);
  assert.match(result.rendered.css, /\[data-node-id="backup_card__toggle"\][\s\S]*margin-left: auto;/);
});
