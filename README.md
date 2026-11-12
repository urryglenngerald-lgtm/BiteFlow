# BiteFlow

Healthy meals for busy people, Tinder style. Swipe right to open the recipe, left to skip, heart to save.
**24 new recipes from different cuisines go live every Monday at 07:00 (Malta time).**

Practice project by Gerald, built with Claude.

## How the app works (plain language)

| Part | What it is |
|---|---|
| `index.html` | The page itself: the layout and the BiteFlow look (cream, green, lime, coral). |
| `app.js` | The brain: loads the menus, does the swiping, works out the nutrition, handles saving and ratings. |
| `data/ingredients.json` | The food table. Every ingredient with its calories, protein, carbs, fat and fibre per 100 g. |
| `weeks/index.json` | The list of weekly menus and the moment each one goes live. |
| `weeks/2026-11-16.json` | One week's 24 recipes. Ingredients are in grams; nutrition is never typed by hand. |
| `weeks/2026-11-16-photos.md` | The photo brief for that week: one image prompt and file name per recipe. |
| `photos/2026-11-16/` | Your photos for that week, named after each recipe (e.g. `cilbir.jpg`). |
| `tools/check.py` | A checker Claude runs before publishing: finds typos in ingredients and prints the macros. |
| `supabase/ratings.sql` | The database setup for the 1 to 5 star ratings. |

### Macros
Each recipe lists ingredients by weight. The app adds up the food-table values for those weights and divides by the number of servings. So if a recipe changes, the macros update themselves.

### The weekly drop
- **Sunday evening:** Claude writes next week's 24 recipes, checks the macros and publishes them here, plus the photo brief.
- **Sunday evening / night:** you make the 24 photos and add them to `photos/<week>/` (or send them to Claude to add).
- **Monday 07:00:** the app switches to the new week on its own. Nothing needs to happen at 7am.

Want to see next week's menu before it goes live? Add `?preview` to the address.
Missing photos are fine: the card shows a coloured placeholder until the photo arrives.
Saved meals from older weeks stay in your Saved tab.

### Ratings
Each phone gets a random anonymous ID, so one phone = one vote per recipe (it can change its vote). The average and number of ratings show on the card and recipe page.

## Photos
Portrait about 3:4 (900 x 1200 is plenty), JPG, dish in the upper half, the bottom third left calm because the card text sits there.

## Opening it on your phone
Live at **https://urryglenngerald-lgtm.github.io/BiteFlow/** once GitHub Pages is switched on.
In Chrome on Android: menu, then **Add to Home screen**, and it opens full-screen like an app.
