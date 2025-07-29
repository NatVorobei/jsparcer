import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";

const regularUrl =
  "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/lutsk/?currency=UAH&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=7000&search%5Bfilter_float_price:to%5D=14000&search%5Bfilter_enum_number_of_rooms_string%5D%5B0%5D=odnokomnatnye&search%5Bfilter_enum_number_of_rooms_string%5D%5B1%5D=dvuhkomnatnye";

const taxFreeUrl =
  "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/lutsk/?currency=UAH&search%5Border%5D=created_at:desc&search%5Bfilter_float_price:from%5D=8000&search%5Bfilter_float_price:to%5D=13000&search%5Bfilter_enum_commission%5D%5B0%5D=1";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

function loadSeenUrls(file) {
  if (!fs.existsSync(file)) return new Set();
  let data = [];
    try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (e) {
    console.warn(`⚠️ Помилка читання ${file}, створюю новий`);
    }
  return new Set(data);
}

function saveSeenUrls(file, set) {
  fs.writeFileSync(file, JSON.stringify([...set], null, 2));
}

async function sendTelegramMessage(text) {
  const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: telegramChatId, text }),
  });
}

async function scrapeQuotes(url, seenFile, isTaxFree = false) {
  const seen = loadSeenUrls(seenFile);
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const newQuotes = [];

  $('div[data-testid="listing-grid"] div[data-cy="l-card"]').each((_, el) => {
    const title = $(el).find("h4").text().trim();
    const price = $(el).find('p[data-testid="ad-price"]').text().trim();
    const href = $(el).find("a").attr("href");
    const date = $(el).find('p[data-testid="location-date"]').text().trim();
    const fullUrl = "https://www.olx.ua" + href;

    if (!seen.has(fullUrl)) {
      newQuotes.push({ title, price, date, url: fullUrl });
      seen.add(fullUrl);
    }
  });

  if (newQuotes.length > 0) {
    saveSeenUrls(seenFile, seen);

    for (const quote of newQuotes) {
      const msg = `${isTaxFree ? "‼️ БЕЗ КОМІСІЇ ‼️\n" : ""}${quote.title}\n${quote.price}\n${quote.date}\n${quote.url}`;
      await sendTelegramMessage(msg);
    }
  }
}

(async function main() {
  console.log("🔍 Scraping...");
  try {
    await scrapeQuotes(regularUrl, "seen_regular.json", false);
    await scrapeQuotes(taxFreeUrl, "seen_taxfree.json", true);
    console.log("✅ Done");
  } catch (e) {
    console.error("❌ Error:", e);
  }
})();
