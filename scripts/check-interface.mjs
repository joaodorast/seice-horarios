import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const qaDirectory = await mkdtemp(join(tmpdir(), "seice-interface-"));
import { createRequire } from "node:module";
import { startTestServer } from "../tests/helpers.ts";
import { upsertUser } from "../server/auth.ts";
import { createApp } from "../server/app.ts";
const require2 = createRequire(process.env.SEICE_PLAYWRIGHT_PACKAGE ?? import.meta.url);
const { chromium } = require2("playwright");
const s = await startTestServer();
let app, browser;
try {
  const units = (await s.call("GET", "/units")).body;
  const ce = units.find((u) => u.code === "CE").id, jp = units.find((u) => u.code === "JP").id;
  const subject = (await s.call("POST", "/subjects", { name: "Sociologia", segments: ["medio"] })).body;
  const initial = (await s.call("POST", "/subjects", { name: "Filosofia", segments: ["medio"] })).body;
  const teacher = (await s.call("POST", "/teachers", { name: "Professor compartilhado (teste)", unitId: ce, unitIds: [ce, jp], segments: ["medio"], subjectIds: [initial.id] })).body;
  const schoolClass = (await s.call("POST", "/classes", { name: "1\xBA Ano Ensino M\xE9dio CE", grade: "Ensino M\xE9dio", unitId: ce, shift: "manha" })).body;
  for (let i = 0; i < 18; i++) {
    const t = i === 0 ? teacher : (await s.call("POST", "/teachers", { name: "Professor de teste " + String(i).padStart(2, "0"), unitId: ce, unitIds: [ce], segments: ["medio"], subjectIds: [subject.id] })).body;
    const c = i === 0 ? schoolClass : (await s.call("POST", "/classes", { name: "1\xBA Ano turma teste " + i, grade: "Ensino M\xE9dio", unitId: ce, shift: "manha" })).body;
    const l = await s.call("POST", "/lessons", { teacherId: t.id, classId: c.id, subjectId: initial.id, weekday: 1, start: "07:30", end: "08:20" });
    if (l.status !== 201) throw Error(JSON.stringify(l.body));
  }
  await upsertUser(s.db, "coord@example.invalid", "Coordena\xE7\xE3o (teste)", "senha-exclusiva-de-teste");
  await s.db.query("UPDATE users SET role='coordenador',unit_id=$1,class_scope=$2::jsonb WHERE email='coord@example.invalid'", [ce, JSON.stringify([{ segment: "medio", years: [1] }])]);
  app = createApp(s.db, { staticDir: resolve("dist") }).app.listen(0);
  await new Promise((r) => app.once("listening", r));
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  await context.request.post(base + "/api/auth/login", { data: { email: "admin@teste.com", password: "senha-de-teste-123" } });
  const page = await context.newPage();
  const log = [];
  const runtimeErrors = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  const scrollPage = async (label) => {
    console.log("Scroll: " + label);
    if (await page.locator("dialog[open]").count()) throw Error("Janela ficou aberta: " + label);
    await page.evaluate(() => {
      document.getElementById("qa-scroll-tail")?.remove();
      if (document.documentElement.scrollHeight <= innerHeight + 100) {
        const spacer = document.createElement("div");
        spacer.id = "qa-scroll-tail";
        spacer.style.height = "1500px";
        document.body.append(spacer);
      }
      window.scrollTo(0, 0);
    });
    const overflow = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    if (["hidden", "clip"].includes(overflow)) throw Error("Rolagem bloqueada: " + label + " " + overflow);
    await page.mouse.move(1340, 650);
    await page.waitForTimeout(250);
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(200);
    if (await page.evaluate(() => scrollY) === 0) await page.mouse.wheel(0, 650);
    try {
      await page.waitForFunction(() => window.scrollY > 20, void 0, { timeout: 3e3 });
    } catch (error) {
      console.log(await page.evaluate(() => ({ path: location.pathname, scrollY, docHeight: document.documentElement.scrollHeight, client: document.documentElement.clientHeight, view: innerHeight, bodyHeight: document.body.scrollHeight, bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow, target: document.elementFromPoint(1250, 650)?.outerHTML.slice(0, 800) })));
      await page.screenshot({ path: join(qaDirectory, "scroll-failure.png") });
      throw error;
    }
    await page.evaluate(() => {
      document.getElementById("qa-scroll-tail")?.remove();
      window.scrollTo(0, 0);
    });
    log.push("Scroll real OK: " + label);
  };
  const visit = async (path) => {
    await page.evaluate((path2) => {
      history.pushState({ ...history.state, idx: (history.state?.idx ?? 0) + 1 }, "", path2);
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }, path);
    await page.waitForLoadState("networkidle");
    await page.locator("h1").first().waitFor();
  };
  await page.goto(base + "/");
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  const paths = ["/", "/professores", `/professores/${teacher.id}`, "/turmas", `/turmas/${schoolClass.id}`, "/disciplinas", "/horarios", "/horarios?dia=semana", `/horarios/professor/${teacher.id}`, `/horarios/turma/${schoolClass.id}`, "/atribuicoes", `/atribuicoes/professor/${teacher.id}`, `/atribuicoes/turma/${schoolClass.id}`, "/horarios/carga", "/horarios/carga-pedagogica", "/atualizacoes", "/configuracoes", "/configuracoes?aba=periodos", "/configuracoes?aba=unidades"];
  for (const path of paths) {
    await visit(path);
    await scrollPage(path);
  }
  const modalCycle = async (path, label) => {
    console.log("Conferindo modal: " + label);
    await visit(path);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: label, exact: true }).first().click();
      await page.locator("dialog[open]").last().waitFor();
      const pane = page.locator("dialog[open]").last().locator("div.overflow-y-auto").first();
      await pane.evaluate((el) => {
        const spacer = document.createElement("div");
        spacer.id = "qa-modal-tail";
        spacer.style.height = "1000px";
        el.append(spacer);
        el.scrollTop = 0;
      });
      const box = await pane.boundingBox();
      await page.mouse.move(box.x + 6, box.y + box.height / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForFunction(() => {
        const p = document.querySelector("dialog[open] .overflow-y-auto");
        return !!p && p.scrollTop > 0;
      }, void 0, { timeout: 3e3 });
      await pane.evaluate((el) => el.querySelector("#qa-modal-tail")?.remove());
      await page.keyboard.press("Escape");
      await page.locator("dialog[open]").waitFor({ state: "hidden" });
      await scrollPage(label + " fechar " + i);
    }
  };
  await modalCycle("/professores", "Novo professor");
  await modalCycle("/turmas", "Nova turma");
  await modalCycle("/disciplinas", "Nova disciplina");
  await modalCycle("/horarios", "Nova aula");
  await modalCycle("/horarios/carga", "Baixar PDF ou Excel");
  await modalCycle("/horarios/carga-pedagogica", "Personalizar c\xE1lculo");
  await modalCycle("/configuracoes", "Importar hor\xE1rios dos turnos");
  console.log("Conferindo avisos sobre formul\xE1rios");
  await visit("/professores");
  await page.getByRole("button", { name: "Novo professor", exact: true }).click();
  let form = page.getByRole("dialog", { name: "Novo professor", exact: true });
  await form.getByRole("button", { name: "Cadastrar professor", exact: true }).click();
  let warning = page.locator("dialog[open]").filter({ has: page.getByRole("button", { name: "Entendi, voltar \xE0 tela", exact: true }) });
  await warning.waitFor();
  await warning.getByRole("button", { name: "Entendi, voltar \xE0 tela" }).click();
  if (await page.locator("dialog[open]").count() !== 1 || await page.evaluate(() => document.documentElement.style.overflow) !== "hidden") throw Error("Aviso liberou o modal de baixo");
  await form.getByRole("textbox", { name: /Nome completo/ }).fill("Nome preservado depois do erro");
  await page.route("**/api/teachers", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "wrong_unit", message: "Esta altera\xE7\xE3o precisa ser feita pela administra\xE7\xE3o." } }) });
    else await route.continue();
  });
  await form.getByRole("button", { name: "Cadastrar professor", exact: true }).click();
  warning = page.getByRole("dialog", { name: "Seu acesso n\xE3o permite esta a\xE7\xE3o", exact: true });
  await warning.waitFor();
  if (await page.locator("dialog[open]").count() !== 2) throw Error("Quantidade incorreta de avisos");
  await page.screenshot({ path: join(qaDirectory, "aviso-acesso.png") });
  await warning.getByRole("button", { name: "Entendi, voltar \xE0 tela" }).click();
  if (await form.getByRole("textbox", { name: /Nome completo/ }).inputValue() !== "Nome preservado depois do erro") throw Error("Campo perdido");
  await page.unroute("**/api/teachers");
  await form.getByRole("button", { name: "Cadastrar professor", exact: true }).click();
  await form.waitFor({ state: "hidden" });
  await scrollPage("salvar professor ap\xF3s erro 403 na mesma tela");
  console.log("Conferindo duas janelas PPP");
  await visit("/horarios/carga-pedagogica");
  await page.getByRole("button", { name: "Personalizar c\xE1lculo", exact: true }).click();
  const rules = page.locator("dialog[open]");
  await rules.locator("input[type=number]").first().fill("202");
  await rules.getByRole("button", { name: "Concluir", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Descartar altera\xE7\xF5es n\xE3o salvas?", exact: true });
  await confirm.waitFor();
  await confirm.getByRole("button", { name: "Continuar editando", exact: true }).click();
  if (await page.evaluate(() => document.documentElement.style.overflow) !== "hidden") throw Error("Descartar liberou janela ainda aberta");
  await rules.getByRole("button", { name: "Concluir", exact: true }).click();
  await confirm.getByRole("button", { name: "Descartar altera\xE7\xF5es", exact: true }).click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await scrollPage("PPP ap\xF3s duas janelas");
  console.log("Conferindo downloads");
  await visit("/horarios/carga");
  for (const excel of [false, true]) {
    await page.getByRole("button", { name: "Baixar PDF ou Excel", exact: true }).click();
    const modal = page.locator("dialog[open]");
    if (excel) await modal.getByRole("radio", { name: /Planilha Excel/ }).click();
    const download = page.waitForEvent("download");
    await modal.getByRole("button", { name: excel ? "Baixar planilha Excel" : "Baixar relat\xF3rio PDF", exact: true }).click();
    await download;
    await modal.waitFor({ state: "hidden" });
    await scrollPage(excel ? "download Excel" : "download PDF");
  }
  for (const path of paths) {
    await visit(path);
    await scrollPage("depois das janelas: " + path);
  }
  for (const kind of ["professor", "turma"]) {
    await page.goto(base + `/imprimir/${kind}/${kind === "professor" ? teacher.id : schoolClass.id}`);
    await page.waitForLoadState("networkidle");
    await scrollPage("impress\xE3o " + kind);
  }
  if (runtimeErrors.length) throw Error(JSON.stringify(runtimeErrors));
  const report = { routes: paths.length + 2, checks: log.length, results: log, artifacts: qaDirectory };
  await writeFile(join(qaDirectory, "resultado.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  app?.close();
  await s.close();
}
