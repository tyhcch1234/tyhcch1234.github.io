#!/usr/bin/env node
/**
 * lock.js — 把明文首頁加密成密碼閘門
 *
 * 流程：build_index.py 產生明文 index.html
 *      -> lock.js 把明文搬到 .plain/index.html（gitignore，不會發佈）
 *      -> 加密成 assets/payload.js
 *      -> 用 gate.template.html 覆寫 index.html
 *
 * 用法：node lock.js [密碼]
 *      密碼預設讀環境變數 SITE_PASSWORD，否則用 "12345678"
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HERE = __dirname;
const PASSWORD = process.argv[2] || process.env.SITE_PASSWORD || "12345678";
const ITER = 200000;

const idxPath = path.join(HERE, "index.html");
const gatePath = path.join(HERE, "gate.template.html");
const plainDir = path.join(HERE, ".plain");
const plainPath = path.join(plainDir, "index.html");
const payloadPath = path.join(HERE, "assets", "payload.js");

const current = fs.readFileSync(idxPath, "utf8");

// 已經上鎖就不要重複加密（避免把閘門本身再加密一次）
if (current.includes('id="gate"') && current.includes("assets/payload.js")) {
  console.log("index.html 已經是閘門，未做任何變更。");
  console.log("如剛重建首頁，請先執行 build_index.py 再執行 lock.js。");
  process.exit(0);
}

// 1. 保存明文（不發佈）
fs.mkdirSync(plainDir, { recursive: true });
fs.writeFileSync(plainPath, current, "utf8");

// 2. 加密
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(PASSWORD, salt, ITER, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(current, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();

fs.mkdirSync(path.dirname(payloadPath), { recursive: true });
fs.writeFileSync(
  payloadPath,
  "window.__GATE__=" +
    JSON.stringify({
      v: 1,
      iter: ITER,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      data: Buffer.concat([ct, tag]).toString("base64"),
    }) +
    ";\n",
  "utf8"
);

// 3. 寫入閘門
const gate = fs.readFileSync(gatePath, "utf8");
fs.writeFileSync(idxPath, gate, "utf8");

console.log(
  "已上鎖：明文 " + current.length + " 字元 -> payload " +
  fs.statSync(payloadPath).size + " bytes；index.html 已改為密碼閘門。"
);
