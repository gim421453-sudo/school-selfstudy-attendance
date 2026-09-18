import test from "node:test";
import assert from "node:assert/strict";
import { uniqueTags } from "./naver-blog-publisher-lib.mjs";

test("deduplicates publication tags", () => assert.deepEqual(uniqueTags(["React", "React", "Firestore"]), ["React", "Firestore"]));
test("does not allow empty tags", () => assert.deepEqual(uniqueTags(["", "  ", "개발일지"]), ["개발일지"]));
