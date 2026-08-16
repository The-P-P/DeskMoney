# BysMoney Desktop

Controle de gastos pessoais com experiência premium — aplicativo nativo para Windows (Tauri 2).

- UI em **pt-BR**
- Moeda **BRL**
- Persistência local **SQLite**
- Auth local + **modo demonstração**

## Pré-requisitos

1. **Node.js** 20+ e npm  
2. **Rust** (stable) — [rustup](https://rustup.rs/)  
3. **Microsoft Visual Studio C++ Build Tools** (Windows)  
4. **WebView2** (já vem no Windows 10/11 modernos)

Verifique:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

## Desenvolvimento

```powershell
cd D:\Desenvolvimento\DeskMoney
npm install
npm run tauri:dev
```

Isso abre a janela nativa com hot-reload do Vite (`http://localhost:1420`).

Scripts úteis:

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Só o frontend Vite (sem SQLite/Tauri) |
| `npm run tauri:dev` | App nativo em modo desenvolvimento |
| `npm run build` | Build do frontend (`tsc` + Vite) |
| `npm run tauri:build` | Build + instalador Windows |

## Build do instalador Windows

```powershell
npm run tauri:build
```

O bundle NSIS (`.exe`) fica em:

```
src-tauri\target\release\bundle\nsis\
```

O executável portátil também é gerado em:

```
src-tauri\target\release\bysmoney.exe
```

> **Nota:** o projeto está configurado com `bundle.targets: ["nsis"]`. Se quiser MSI (WiX Toolset), altere `src-tauri/tauri.conf.json` para incluir `"msi"`.

## Estrutura

```
src/
  domain/       Tipos, Zod, labels pt-BR
  db/           SQLite (plugin Tauri), repos, seed demo, auth
  features/     Auth, Dashboard, Finanças, Planejamento, Relatórios, Configurações
  components/   UI (shadcn) + layout (sidebar, palette, tour)
  stores/       Sessão, UI, recentes (Zustand)
  lib/          Dinheiro (centavos), datas, export CSV/PDF, atalhos
src-tauri/      Shell Tauri 2 + migrations SQL
```

## Funcionalidades (v1)

- Dashboard com KPIs e widgets  
- Finanças: Lançamentos, Futuros, Contas, Categorias  
- Planejamento: Orçamentos, Metas, Recorrentes  
- Relatórios (5 abas) + export CSV/PDF  
- Configurações: perfil, preferências, tema, notificações, PIN, LGPD  
- Busca rápida (Ctrl+K), atalhos `g`+letra, `n`, `?`  
- Tema Claro / Escuro / Sistema  
- Ocultar saldos + PIN para contas arquivadas  
- Product tour + modo demo com seed  

## Checklist de paridade (§13 do inventário)

- [ ] Telas/abas com labels pt-BR  
- [ ] Sidebar + palette + atalhos  
- [ ] CRUD contas, categorias, lançamentos, orçamentos, metas, recorrentes  
- [ ] Futuros = lançamentos futuros + “Previsto” de recorrentes  
- [ ] Dashboard e Relatórios com KPIs/export CSV  
- [ ] Preferências, tema, ocultar saldos, PIN, LGPD  
- [ ] Modo demo + categorias padrão  
- [ ] pt-BR + BRL  
- [ ] Instalador Windows (`npm run tauri:build`)  

## Fora de escopo v1

Organization/white-label, AuditLog, transferências na UI, push real, sync cloud/OAuth, multi-idioma.

## Produto

A fonte da verdade de produto é [`BYSMONEY-PRODUTO.md`](./BYSMONEY-PRODUTO.md).
