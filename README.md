# BysMoney Desktop

Controle de gastos pessoais com experiência premium — aplicativo nativo para Windows (Tauri 2).

- UI em **pt-BR**
- Moeda **BRL**
- Persistência local **SQLite**
- Auth local + **modo demonstração**
- Atualização in-app via GitHub Releases

## Download

Instalador Windows (qualquer pessoa):

➡️ **[Baixar a última versão](https://github.com/The-P-P/DeskMoney/releases/latest)**

1. Abra a release mais recente
2. Baixe `BysMoney_*_x64-setup.exe` em **Assets**
3. Execute o instalador (instalação por usuário, sem admin)

> Na primeira execução o Windows SmartScreen pode avisar (“Windows protegeu o computador”) porque o instalador ainda não tem certificado Authenticode pago. Use **Mais informações → Executar assim mesmo**.

Depois de instalado, atualize pelo próprio app: **Configurações → Sobre e atualizações → Verificar atualizações**.

## Pré-requisitos (desenvolvimento)

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

## Build do instalador Windows (local)

```powershell
# Chave de assinatura do updater (obrigatória com createUpdaterArtifacts)
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\bysmoney.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content "$env:USERPROFILE\.tauri\bysmoney.key.password" -Raw

npm run tauri:build
```

O bundle NSIS (`.exe`) fica em:

```
src-tauri\target\release\bundle\nsis\
```

Também são gerados `.sig` e, no CI, o `latest.json` para o atualizador.

## Publicar uma nova versão (GitHub Releases)

1. Atualize a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (mesmo número, ex. `0.1.1`)
2. Commit e push em `main`
3. Crie e envie a tag:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

4. O workflow **Release** (GitHub Actions) gera o instalador Windows, assina o update e publica a Release
5. Usuários com o app instalado usam **Verificar atualizações** nas Configurações

Secrets necessários no repositório (`Settings → Secrets and variables → Actions`):

| Secret | Conteúdo |
|--------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Conteúdo de `~\.tauri\bysmoney.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Senha da chave |

Guarde a chave privada e a senha com segurança. Se perdê-las, quem já instalou o app **não recebe mais updates** até reinstalar.

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
.github/        CI de release (Windows NSIS + updater)
```

## Funcionalidades (v1)

- Dashboard com KPIs e widgets  
- Finanças: Lançamentos, Futuros, Contas, Categorias  
- Planejamento: Orçamentos, Metas, Recorrentes  
- Relatórios (5 abas) + export CSV/PDF  
- Configurações: perfil, preferências, tema, notificações, PIN, LGPD, **atualizações**  
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
- [x] Instalador Windows (`npm run tauri:build` / GitHub Releases)  
- [x] Atualização in-app (Configurações)  

## Fora de escopo v1

Organization/white-label, AuditLog, transferências na UI, push real, sync cloud/OAuth, multi-idioma.

## Produto

A fonte da verdade de produto é [`BYSMONEY-PRODUTO.md`](./BYSMONEY-PRODUTO.md).
