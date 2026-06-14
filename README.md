# Nitro Scan

Nitro Scan é uma aplicação React, TypeScript e Vite criada para apresentar uma plataforma visual de inteligência comportamental aplicada a diagnóstico eletrônico. A home foi construída como um centro de comando futurista, com arquitetura operacional, monitoramento, evidências técnicas, registros ao vivo, análise e um núcleo central chamado Nitro Core.

## Visão Geral

O projeto simula uma interface premium para investigação técnica, organização de hipóteses, leitura de medições, consulta de assinaturas universais e geração de fluxo diagnóstico. A proposta visual é transmitir uma plataforma enterprise/cyberpunk, com foco em arquitetura de sistema e leitura operacional.

## Tecnologias

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação

Instale as dependências:

```bash
npm install
```

Em ambientes de CI/CD ou instalação reprodutível, use:

```bash
npm ci
```

## Rodar Localmente

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Depois acesse:

```text
http://localhost:5173/
```

## Gerar Build de Produção

Execute:

```bash
npm run build
```

Os arquivos finais serão gerados em:

```text
dist/
```

Para testar o build localmente:

```bash
npm run preview
```

## Publicação no GitHub Pages

O projeto já inclui um workflow de GitHub Actions em:

```text
.github/workflows/deploy.yml
```

Sempre que houver push na branch `main`, o workflow:

1. Instala as dependências com `npm ci`.
2. Gera o build de produção com o `base` correto para GitHub Pages.
3. Publica a pasta `dist/` como artefato do GitHub Pages.
4. Faz o deploy automático da aplicação.

Para ativar a publicação:

1. Abra o repositório no GitHub.
2. Vá em `Settings` -> `Pages`.
3. Em `Build and deployment`, selecione `GitHub Actions`.
4. Faça push na branch `main` ou execute manualmente o workflow `Deploy to GitHub Pages`.

Se o repositório se chamar `nitro-scan`, o link final normalmente será:

```text
https://<usuario-github>.github.io/nitro-scan/
```

## Estrutura Principal

```text
src/
  components/
  engine/
  data/
public/
dist/
```

## Segurança e Versionamento

O `.gitignore` foi configurado para evitar o versionamento de:

- `node_modules/`
- `dist/`
- arquivos `.env`
- logs
- caches de build
- pastas locais de editor
- arquivos locais de automação

Nunca suba senhas, tokens, chaves privadas, dados sensíveis ou informações reais de clientes.
