import * as cheerio from "cheerio";
import type { Tuition, TuitionRate } from "../../../domain/major";

export interface ParsedRates {
  currency: string;
  rates: TuitionRate[];
}

function currencyOf(amountText: string): string | null {
  if (amountText.includes("$") || /usd/i.test(amountText)) return "USD";
  if (/egp|e£|\bLE\b/i.test(amountText)) return "EGP";
  return null;
}

/**
 * The tuition page has a "Tuition Rate per Credit Hour" block with one card per
 * student group. Only the undergraduate cards are read. Returns null when the
 * block isn't there, which is what a layout change looks like.
 */
export function parseUndergraduateRates(html: string): ParsedRates | null {
  const $ = cheerio.load(html);

  const block = $("section")
    .filter((_, el) => /per credit hour/i.test($(el).find("h2").first().text()))
    .first();
  if (block.length === 0) return null;

  const rates: TuitionRate[] = [];
  let currency: string | null = null;

  block.find(".publications__item").each((_, el) => {
    const amountText = $(el).find(".publications__item-heading").first().text().trim();
    const label = $(el).find(".publications__item-description").first().text().replace(/\s+/g, " ").trim();
    if (!/undergraduate/i.test(label)) return;

    const amount = Number(amountText.replace(/[^0-9.]/g, ""));
    const rowCurrency = currencyOf(amountText);
    if (!Number.isFinite(amount) || amount <= 0 || !rowCurrency) return;

    currency ??= rowCurrency;
    if (rowCurrency !== currency) return;

    const cleaned = label.replace(/^undergraduate\s+/i, "");
    rates.push({ label: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), amountPerCreditHour: amount });
  });

  if (rates.length === 0 || !currency) return null;
  return { currency, rates };
}

export function buildTuition(parsed: ParsedRates, creditHours: number | null, sourceUrl: string): Tuition {
  return {
    currency: parsed.currency,
    rates: parsed.rates,
    estimatedTotals:
      creditHours == null
        ? []
        : parsed.rates.map((rate) => ({ label: rate.label, amount: rate.amountPerCreditHour * creditHours })),
    sourceUrl,
  };
}
