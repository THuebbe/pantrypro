---
title: Recipe draft stage contract
description: What the recipe drafting step takes in, does, hands back, and how its output is checked
reviewed: 11-16-2026
---
# Recipe draft

One job: propose the ingredients and portions for **one menu item**, for the owner to correct and save. It follows the stage-contract shape from Interpretable Context Methodology: named inputs, a numbered process, a named output, and one check.

## Inputs
- **The menu item:** name, category and price, from `menu_items`.
- **The restaurant's inventory list:** ingredient id, name, category and the unit it is counted in, from `restaurant_inventory` joined to `ingredient_library`.
- **The standing rules:** [`rules.md`](rules.md). These hold for every run.

Not loaded: other restaurants' data, sales history, costs, stock levels, and any existing recipe for the item.

## Process
1. Load the inputs. Stop with a clear message if the inventory list is empty.
2. Build the answer form from the inventory list: the model may pick ingredients only by id from that list, and units only from the app's unit list (`recipeDraftCore.js`).
3. Ask the model once, with `rules.md` as the instructions and the form as a required tool call.
4. Run the check below on every line the model returned (`validateDraft`).
5. Return the draft. Nothing is written to the database.

## Output
A draft the owner can edit on the Recipe Builder screen:
- `lines`: ingredient, quantity and unit, each one having passed the check
- `missing`: ingredients the dish needs that are not in inventory yet, by name
- `rejected`: lines that failed the check, each with the reason
- `rulesVersion` and `model`, so a draft can be traced to the rules that produced it

## The check
A line is kept only if **all** of these hold. Code decides this, not the model.
- the ingredient id is in this restaurant's inventory list
- the ingredient appears once
- the quantity is a number greater than zero
- the unit converts to the unit the ingredient is counted in (weight to weight, volume to volume, count to count)
- the portion is plausible for one serving (limits in `recipeDraftCore.js`)

## Authority
- **Drafting:** allowed for any signed-in user of the restaurant, for that restaurant's own menu items.
- **Saving a recipe:** only the owner, by pressing Save on the review screen. This step never saves.
- **Creating inventory items:** never. Missing ingredients are listed for the owner to add.

## What changes where
- Wording of the rules, portion guidance: `rules.md` (bump its `version`).
- The check and its limits: `recipeDraftCore.js`, with a unit test for each change.
- Which model is used: the `RECIPE_DRAFT_MODEL` environment variable.
