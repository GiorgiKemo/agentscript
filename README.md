# AgentScript Prototype

AgentScript is a prototype word-based UI language that compiles into a compact binary bytecode format and then renders static web output.

This prototype is intentionally strict:

- layout lives in a `.agent` file
- styling and reordering live in a `.style` file
- both files compile into `app.awuib` bytecode
- the renderer turns that bytecode into `index.html` and `app.css`

## Why this exists

The goal is not to hide complexity behind React-style APIs. The goal is to let humans and AI write simple UI instructions while a compiler handles parsing, validation, binary encoding, and rendering.

This does **not** prove "faster than every language on earth." That claim is not realistic. What this prototype does prove is:

- simple word-based authoring
- a binary output format
- a deterministic compile pipeline
- a very small runtime path with no framework dependency

## Project docs

- `docs/problem-inventory.md`: prioritized list of JavaScript and web platform issues we are designing against
- `docs/roadmap.md`: phased build order for the language, runtime, VM, and tooling
- `docs/ai-first-principles.md`: rules for making the language easy for AI agents to generate, edit, and validate

## Layout syntax

```txt
page Launch

navbar {
  button 1 "Home"
  button 2 "Features"
  button 3 "Pricing"
  button 4 "Login"
}

hero intro {
  heading title "Build UI in words"
  text pitch "A language for agents that compiles to binary."
}
```

Supported containers:

- `navbar`
- `hero`
- `main`
- `section`
- `footer`
- `row`
- `column`

Supported leaf nodes:

- `button`
- `heading`
- `text`
- `field`

Leaf nodes can also bind to state:

```txt
text click_count from clicks
field note_input from note
```

Fields are two-way bound. When the user types into a `field`, the bound text state updates and any other bindings to that state update too.

## State and events

State is declared at the top level:

```txt
state clicks 0
state status "Waiting for your first click"
```

Click handlers are explicit:

```txt
when click pulse {
  add 1 to clicks
  if clicks is 1 {
    set status to "First click unlocked the panel"
    change text of pulse to "Click Again"
  } else {
    set status to "AgentScript state updated"
    change text of pulse to "Clicked Again"
  }
  open detail
}
```

Other supported handler shapes:

```txt
when input note_input {
  if note is "Type a note for the panel" {
    set status to "Waiting for your first click"
  } else {
    set status to "Note ready for the panel"
  }
}
```

Recommended English-style actions:

- `add <number> to <state>`
- `take <number> from <state>`
- `set <state> to <number>`
- `set <state> to "text"`
- `set <state> to <other_state>`
- `reset <state>`
- `open <node>`
- `close <node>`
- `change text of <node> to "text"`
- `change text of <node> to <state>`
- `if <state> is <value> { ... }`
- `if <state> is not <value> { ... }`
- `if <state> is greater than <number-or-state> { ... }`
- `if <state> is less than <number-or-state> { ... }`
- `else { ... }`

Also supported for compatibility:

- `increase <state> by <number>`
- `decrease <state> by <number>`
- `show <node>`
- `hide <node>`
- `set text <node> to "text"`
- `set text <node> to <state>`

## Style syntax

```txt
select 4 {
  background royalblue
  color white
  radius 999px
  switch position with 3
}
```

Supported style commands:

- `color <value>`
- `text color <value>`
- `background <value>`
- `fill <value>`
- `hide`
- `show`
- `center`
- `center text`
- `bold`
- `shadow soft|medium|strong|none`
- `stack`
- `line up`
- `round <number>px`
- `space <number>px`
- `grow`
- `grow <number>`
- `spread out`
- `arrange row|column`
- `align start|center|end|stretch`
- `justify start|center|end|between`
- `center items`
- `center content`
- `push right`
- `push left`
- `size <number>px`
- `size <width>px <height>px`
- `increase size by <number>px`
- `text size <number>px`
- `increase text size by <number>px`
- `font-size <number>px`
- `increase font-size by <number>px`
- `width <number>px`
- `increase width by <number>px`
- `height <number>px`
- `increase height by <number>px`
- `gap <number>px`
- `radius <number>px`
- `padding <number>px <number>px`
- `direction row|column`
- `move before <id>`
- `move after <id>`
- `switch position with <id>`

The English-style commands lower into canonical internal properties. For example:

- `increase size by 10px` becomes `increase-width` and `increase-height`
- `increase text size by 4px` becomes `increase-font-size`
- `fill blue` becomes `background`
- `round 18px` becomes `radius`
- `space 16px` becomes `gap`
- `grow` becomes `flex-grow: 1`
- `grow 2` becomes `flex-grow: 2`
- `spread out` becomes `justify-content: space-between`
- `push right` becomes `margin-left: auto`
- `push left` becomes `margin-right: auto`
- `center items` becomes `align-items: center`
- `center` on a container centers its content
- `center` on a node centers that node relative to its parent
- `center text` becomes `text-align: center`
- `bold` becomes `font-weight: 700`
- `stack` becomes `direction: column`
- `line up` becomes `direction: row`

## Run it

```bash
npm run compile
```

That writes:

- `dist/app.awuib`
- `dist/index.html`
- `dist/app.css`
- `dist/app.js`

To inspect the decoded binary:

```bash
npm run inspect
```

To run syntax and validation checks without writing output:

```bash
npm run check
```

To open the generated page in a browser and inspect the DOM/CSS:

```bash
npm run preview
```

That serves the compiled output at:

- `http://localhost:4173`

To run the baseline regression tests:

```bash
npm test
```
