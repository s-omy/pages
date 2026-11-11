"use strict";

// Each producer owns only its category's latest.json; the hub is never rewritten.
function validBrief(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || typeof value.tagline !== "string" ||
      value.tagline.trim().length === 0 || value.tagline.length > 120) return false;
  const date = new Date(value.date + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date;
}

async function updateBrief(category) {
  const card = document.querySelector(`[data-brief="${category}"]`);
  try {
    const response = await fetch(`${category}/latest.json`, {cache: "no-store"});
    if (!response.ok) throw new Error("Metadata unavailable");
    const brief = await response.json();
    if (!validBrief(brief)) throw new Error("Invalid brief metadata");
    // Use textContent so report text is never interpreted as HTML.
    card.querySelector("[data-tagline]").textContent = brief.tagline.trim();
    card.querySelector("[data-date]").textContent = `${brief.date.replaceAll("-", ".")} 発行号 · JST`;
  } catch {
    card.querySelector("[data-date]").textContent = "見出しを取得できませんでした。最新号はリンク先で確認できます。";
  }
}

// A failure in either category does not prevent the other card from updating.
Promise.allSettled([updateBrief("games"), updateBrief("vtuber")]);
