import test from "node:test";
import assert from "node:assert/strict";
import { parseLayoutAst, parseStyleAst } from "../src/compiler/parser.js";

test("parseLayoutAst produces source-spanned nodes", () => {
  const source = `page Demo

state count 0

navbar nav {
  text label from count
}

when click label_button {
  increase count by 1
}`;

  const ast = parseLayoutAst(source);
  const navbar = ast.body[0];
  const label = navbar.children[0];

  assert.equal(ast.type, "LayoutProgram");
  assert.equal(ast.pageName, "Demo");
  assert.equal(ast.states[0].id, "count");
  assert.equal(ast.handlers[0].targetId, "label_button");
  assert.equal(navbar.type, "ContainerNode");
  assert.equal(navbar.id, "nav");
  assert.equal(navbar.span.start.line, 5);
  assert.equal(label.type, "LeafNode");
  assert.equal(label.content.type, "BindingContent");
  assert.equal(label.content.stateId, "count");
  assert.equal(label.span.start.line, 6);
});

test("parseStyleAst groups declaration parts by line", () => {
  const source = `select button 1 {
  background royalblue
  switch position with 2
}`;

  const ast = parseStyleAst(source);
  const rule = ast.rules[0];

  assert.equal(rule.targetKind, "button");
  assert.equal(rule.targetId, "1");
  assert.deepEqual(rule.declarations[0].parts, ["background", "royalblue"]);
  assert.deepEqual(rule.declarations[1].parts, ["switch", "position", "with", "2"]);
});

test("layout parser reports location-aware syntax errors", () => {
  const source = `page Demo

text label from`;

  assert.throws(
    () => parseLayoutAst(source),
    /Expected a state id after `from` at line 3, column 16/
  );
});

test("parseLayoutAst supports conditional action blocks", () => {
  const source = `page Demo

state clicks 0

button pulse "Pulse"

when click pulse {
  if clicks is greater than 1 {
    add 1 to clicks
  } else {
    reset clicks
  }
}`;

  const ast = parseLayoutAst(source);
  const condition = ast.handlers[0].actions[0];

  assert.equal(condition.type, "ConditionBlock");
  assert.equal(condition.targetStateId, "clicks");
  assert.equal(condition.operator, "greater-than");
  assert.equal(condition.valueToken.value, "1");
  assert.equal(condition.actions[0].type, "ActionStatement");
  assert.deepEqual(condition.actions[0].parts, ["add", "1", "to", "clicks"]);
  assert.equal(condition.elseActions[0].type, "ActionStatement");
  assert.deepEqual(condition.elseActions[0].parts, ["reset", "clicks"]);
});

test("parseLayoutAst supports app pages and start page declarations", () => {
  const source = `app Demo

start page home

state count 0

create page home {
  button open_about "About"
}

create page about {
  text note "About page"
}

when click open_about {
  go to page about
}`;

  const ast = parseLayoutAst(source);

  assert.equal(ast.programKind, "app");
  assert.equal(ast.appName, "Demo");
  assert.equal(ast.startPageId, "home");
  assert.equal(ast.pages.length, 2);
  assert.equal(ast.pages[0].id, "home");
  assert.equal(ast.pages[1].id, "about");
  assert.equal(ast.pages[0].body[0].kind, "button");
  assert.deepEqual(ast.handlers[0].actions[0].parts, ["go", "to", "page", "about"]);
});

test("parseLayoutAst supports block definitions, block usage, and boolean states", () => {
  const source = `app Demo

state ready true

create block stat_card {
  section shell {
    text value from ready
  }
}

create page home {
  use block stat_card as primary_card
}
`;

  const ast = parseLayoutAst(source);

  assert.equal(ast.states[0].valueToken.value, "true");
  assert.equal(ast.blocks.length, 1);
  assert.equal(ast.blocks[0].id, "stat_card");
  assert.equal(ast.blocks[0].body[0].type, "ContainerNode");
  assert.equal(ast.pages[0].body[0].type, "BlockUsage");
  assert.equal(ast.pages[0].body[0].blockId, "stat_card");
  assert.equal(ast.pages[0].body[0].instanceId, "primary_card");
});
