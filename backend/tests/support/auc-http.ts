import { readdirSync } from "node:fs";
import { PAGES } from "../../src/infrastructure/universities/auc/urls";
import { FakeHttp } from "./fake-http";
import { fixtureJson, fixtureText } from "./fixtures";

const API = "https://catalog.aucegypt.edu/widget-api";

/** A FakeHttp that serves the trimmed AUC fixtures under the real urls. */
export function aucHttp(): FakeHttp {
  const http = new FakeHttp()
    .on(`${API}/catalogs/?type=default`, fixtureJson("auc/catalogs.json"))
    .on(`${API}/catalog/32/programs/?page-size=100&page=1`, fixtureJson("auc/programs-page1.json"))
    .on(PAGES.programs, fixtureText("auc/main-programs.html"))
    .on(PAGES.tuition, fixtureText("auc/tuition.html"))
    .on(PAGES.generalAdmission, fixtureText("auc/admissions-general.html"))
    .on(PAGES.scienceAdmission, fixtureText("auc/admissions-se.html"))
    .on(PAGES.businessAdmission, fixtureText("auc/admissions-business.html"));

  const dir = new URL("../fixtures/auc/", import.meta.url);
  for (const file of readdirSync(dir)) {
    const program = /^program-(\d+)\.json$/.exec(file);
    if (program) http.on(`${API}/catalog/32/program/${program[1]}/`, fixtureJson(`auc/${file}`));
    const hierarchy = /^hierarchy-(\d+)\.json$/.exec(file);
    if (hierarchy) http.on(`${API}/catalog/32/hierarchy/${hierarchy[1]}/`, fixtureJson(`auc/${file}`));
  }
  return http;
}
