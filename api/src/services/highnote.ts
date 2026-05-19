import { Highnote } from "@highnote-oss/nodejs-sdk";
import type { HighnoteEnvironment } from "@highnote-oss/nodejs-sdk";

const apiKey = process.env.HIGHNOTE_API_KEY;
if (!apiKey) {
  throw new Error(
    "HIGHNOTE_API_KEY is required. Copy .env.template to .env and set your key."
  );
}

export const environment = (process.env.HIGHNOTE_ENVIRONMENT ?? "test") as HighnoteEnvironment;

export const highnote = new Highnote({ apiKey, environment });

export const cardProductId = process.env.HIGHNOTE_CARD_PRODUCT_ID ?? "";
