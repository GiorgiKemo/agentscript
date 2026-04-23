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
