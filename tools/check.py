#!/usr/bin/env python3
"""BiteFlow week checker.

Run:  python3 tools/check.py            (checks every week)
      python3 tools/check.py 2026-11-23 (checks one week and writes its photo brief)

It checks that every ingredient exists in data/ingredients.json, that recipe ids
are unique across all weeks, prints the nutrition per serving the app will show,
and writes weeks/<week>-photos.md with one image prompt per recipe.
"""
import json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ING = json.loads((ROOT / "data/ingredients.json").read_text())["items"]
INDEX = json.loads((ROOT / "weeks/index.json").read_text())
REQUIRED = ["id", "name", "cuisine", "meal", "time", "serves", "desc", "colors", "ing", "steps"]
MEALS = {"Breakfast", "Lunch", "Dinner"}


def nutrition(r):
    t = dict(k=0.0, p=0.0, c=0.0, f=0.0, fi=0.0)
    for key, grams, *_ in r["ing"]:
        for m in t:
            t[m] += ING[key][m] * grams / 100
    return {m: v / r["serves"] for m, v in t.items()}


def photo_prompt(r):
    return (
        f"Subject: {r['photo']}. "
        "Composition: portrait 3:4, the dish fills the upper half of the frame, "
        "the bottom third is a calm, uncluttered table surface (text will sit there). "
        "Environment: warm cream linen and a light wooden table, one or two simple props at most. "
        "Aesthetic: fresh, natural, appetising home cooking, not overly styled, realistic portion. "
        "Camera: 45-degree angle, 50 mm lens, shallow depth of field, dish in sharp focus. "
        "Lighting: soft daylight from a window on the left, gentle shadows, true-to-life colours. "
        "Constraints: no text, no logos, no hands, no cutlery clutter, no people."
    )


def check_week(week, write_brief):
    path = ROOT / f"weeks/{week}.json"
    data = json.loads(path.read_text())
    recipes = data["recipes"]
    errors = []
    print(f"\n== {week}: {data.get('title', '')} ({len(recipes)} recipes) ==")
    print(f"{'id':26} {'cuisine':14} {'meal':9} kcal  prot carb  fat fibre")
    for r in recipes:
        for f in REQUIRED:
            if f not in r:
                errors.append(f"{r.get('id', '?')}: missing '{f}'")
        if r.get("meal") not in MEALS:
            errors.append(f"{r['id']}: meal must be Breakfast, Lunch or Dinner")
        bad = [i[0] for i in r["ing"] if i[0] not in ING]
        if bad:
            errors.append(f"{r['id']}: unknown ingredients {bad} (add them to data/ingredients.json)")
            continue
        n = nutrition(r)
        print(f"{r['id']:26} {r['cuisine'][:14]:14} {r['meal']:9} {n['k']:4.0f} {n['p']:5.1f} {n['c']:4.0f} {n['f']:4.0f} {n['fi']:5.1f}")
        if n["k"] > 900:
            errors.append(f"{r['id']}: {n['k']:.0f} kcal per serving looks too high for BiteFlow")
    if write_brief:
        lines = [f"# Photos for the week of {week}", "",
                 f"Save each photo as JPG, portrait about 3:4 (e.g. 900 x 1200), to `photos/{week}/<file name>`.", ""]
        for i, r in enumerate(recipes, 1):
            lines += [f"## {i}. {r['name']} ({r['cuisine']})", f"File: `photos/{week}/{r['id']}.jpg`", "",
                      photo_prompt(r) if r.get("photo") else "(no photo brief)", ""]
        (ROOT / f"weeks/{week}-photos.md").write_text("\n".join(lines))
        print(f"Photo brief written to weeks/{week}-photos.md")
    return errors


def main():
    weeks = [w["week"] for w in INDEX["weeks"]]
    only = sys.argv[1:] or weeks
    seen, errors = {}, []
    for w in weeks:
        for r in json.loads((ROOT / f"weeks/{w}.json").read_text())["recipes"]:
            if r["id"] in seen:
                errors.append(f"id '{r['id']}' used in both {seen[r['id']]} and {w}")
            seen[r["id"]] = w
    for w in only:
        errors += check_week(w, write_brief=bool(sys.argv[1:]))
    print()
    if errors:
        print("PROBLEMS:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("All good.")


if __name__ == "__main__":
    main()
