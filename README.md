# Galeria Upload com Busca Inteligente por IA

Sistema de galeria de imagens com análise automática por Google Gemini Vision e busca inteligente em linguagem natural.

## Funcionalidades

- 📤 Upload de imagens/documentos
- 🤖 Análise automática com Google Gemini Vision
- 🔍 Busca inteligente em linguagem natural
- 📋 Sugestões de documentos faltantes
- 🏷️ Tags e keywords automáticas
- 💾 Armazenamento em SQLite

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar API Key do Gemini

1. Obtenha uma API key gratuita em: https://aistudio.google.com/apikey
2. Crie um arquivo `.env` na raiz do projeto:

```env
GEMINI_API_KEY_AI=sua_api_key_aqui
```

**Nota:** O arquivo `.env` já está no `.gitignore` para segurança.

### 3. Iniciar o servidor

```bash
npm run server
```

O servidor estará rodando em `http://localhost:3001`

### 4. Iniciar o frontend

Em outro terminal:

```bash
npm run dev
```

O frontend estará rodando em `http://localhost:5173` (ou outra porta indicada pelo Vite)

## Como Usar

### Upload de Documentos

1. Faça upload de imagens através do botão "Upload" ou arrastando arquivos
2. As imagens serão automaticamente analisadas pelo Gemini Vision
3. O sistema extrairá:
   - Tipo de documento (passaporte, identidade, comprovante, etc.)
   - Keywords relevantes
   - Descrição do conteúdo
   - País de origem (se aplicável)

### Busca Inteligente

Digite na barra de busca em linguagem natural, por exemplo:

- "documentos para renovar AR em Portugal"
- "comprovantes de residência"
- "passaporte brasileiro"
- "documentos de identidade"

O sistema irá:
1. Interpretar sua busca
2. Encontrar documentos relevantes
3. Sugerir documentos que você pode precisar mas ainda não tem
4. Fornecer dicas de como obter documentos faltantes

## Estrutura do Banco de Dados

O banco SQLite armazena:

- `id` - ID único
- `filename` - Nome do arquivo no servidor
- `originalname` - Nome original
- `mimetype` - Tipo MIME
- `size` - Tamanho em bytes
- `created_at` - Data de criação
- `ai_description` - Descrição gerada pela IA
- `ai_keywords` - Keywords separadas por vírgula
- `ai_document_type` - Tipo de documento identificado
- `ai_country` - País do documento (se aplicável)
- `ai_typical_use` - Uso típico do documento

## Tecnologias

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Express.js + SQLite
- **IA:** Google Gemini Vision API
- **Upload:** Multer

## Visualizar Banco de Dados

Acesse `http://localhost:3001/db` para ver uma visualização HTML do banco de dados.

## Notas

- A análise por IA acontece automaticamente no upload
- Se a API key não estiver configurada, o sistema funcionará mas sem análise inteligente
- A busca funciona melhor com pelo menos 3 caracteres
- Os resultados são filtrados em tempo real conforme você digita

