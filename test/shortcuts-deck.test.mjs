import test from "node:test";
import assert from "node:assert/strict";
import { Category } from "../src/domain/entities/Category.js";
import { Bookmark } from "../src/domain/entities/Bookmark.js";
import { Id } from "../src/domain/valueObjects/Id.js";
import { Url } from "../src/domain/valueObjects/Url.js";

test("Category entity: creates, renames, and serializes correctly", () => {
  const cat = new Category({ id: new Id("cat-1"), name: "Development", order: 0 });
  assert.equal(cat.id.value, "cat-1");
  assert.equal(cat.name, "Development");
  assert.equal(cat.order, 0);

  cat.rename("Coding & Tools");
  assert.equal(cat.name, "Coding & Tools");

  const json = cat.toJSON();
  assert.deepEqual(json, { id: "cat-1", name: "Coding & Tools", order: 0 });

  const restored = Category.fromJSON(json);
  assert.equal(restored.id.value, "cat-1");
  assert.equal(restored.name, "Coding & Tools");
});

test("Bookmark entity: creates universal direct URL shortcut", () => {
  const bm = new Bookmark({
    id: new Id("bm-1"),
    title: "GitHub",
    url: new Url("https://github.com/"),
    categoryId: new Id("cat-1"),
  });

  assert.equal(bm.id.value, "bm-1");
  assert.equal(bm.title, "GitHub");
  assert.equal(bm.url.href, "https://github.com/");
  assert.equal(bm.categoryId.value, "cat-1");

  const json = bm.toJSON();
  assert.equal(json.id, "bm-1");
  assert.equal(json.title, "GitHub");
  assert.equal(json.url, "https://github.com/");

  const restored = Bookmark.fromJSON(json);
  assert.equal(restored.id.value, "bm-1");
  assert.equal(restored.title, "GitHub");
});
