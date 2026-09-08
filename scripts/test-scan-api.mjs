import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(".env.local") });

const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const identifier = process.env.TEST_ADMIN_USER ?? "admin";
const password = process.env.TEST_ADMIN_PASSWORD ?? "admin@123";

const dishImage = path.join(".requirements", "images", "WhatsApp Image 2026-09-07 at 10.47.42 AM.jpeg");
const fridgeImage = path.join(".requirements", "images", "WhatsApp Image 2026-09-07 at 10.47.39 AM.jpeg");
const dishBase64 = fs.readFileSync(dishImage).toString("base64");
const fridgeBase64 = fs.readFileSync(fridgeImage).toString("base64");

async function post(url, body, token) {
  const started = Date.now();
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, ms: Date.now() - started, json };
}

const login = await post("/api/admin/login", { identifier, password });
const token = login.json?.data?.accessToken;
if (!token) {
  console.log(JSON.stringify({ error: "login failed", status: login.status, response: login.json }, null, 2));
  process.exit(1);
}

console.log("=== 1) POST /api/scan (dish mode) ===");
const scanDish = await post(
  "/api/scan",
  {
    image_base64: dishBase64,
    mime: "image/jpeg",
    language: "English",
    fridge_mode: false,
  },
  token,
);
console.log(JSON.stringify({ status: scanDish.status, ms: scanDish.ms, response: scanDish.json }, null, 2));

console.log("\n=== 2) POST /api/scan (fridge mode) ===");
const scanFridge = await post(
  "/api/scan",
  {
    image_base64: fridgeBase64,
    mime: "image/jpeg",
    language: "English",
    fridge_mode: true,
  },
  token,
);
console.log(JSON.stringify({ status: scanFridge.status, ms: scanFridge.ms, response: scanFridge.json }, null, 2));

const ingredients = scanDish.json?.data?.ingredients ?? [];
const dishName = scanDish.json?.data?.dish_name;
const chatPrompt = dishName
  ? `Create a recipe for ${dishName} using: ${ingredients.join(", ")}`
  : `Create a recipe using: ${ingredients.join(", ")}`;

console.log("\n=== 3) POST /api/chat (recipe from scan) ===");
console.log("Prompt:", chatPrompt);
const chat = await post(
  "/api/chat",
  {
    prompt: chatPrompt,
    language: "English",
  },
  token,
);
const recipe = chat.json?.data ?? {};
console.log(
  JSON.stringify(
    {
      status: chat.status,
      ms: chat.ms,
      response: chat.json.success
        ? {
            success: true,
            data: {
              title: recipe.title,
              cook_time: recipe.cook_time,
              calories: recipe.calories,
              ingredients: recipe.ingredients,
              steps: recipe.steps,
              tags: recipe.tags,
              chef_tips: recipe.chef_tips,
              nutrition: recipe.nutrition,
              image: recipe.image,
            },
          }
        : chat.json,
    },
    null,
    2,
  ),
);
