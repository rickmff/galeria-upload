# 📸 Galeria de Upload

Uma aplicação web completa para upload e gerenciamento de galeria de imagens, construída com React + Vite no frontend e Express + SQLite no backend. Projeto simples e direto ao ponto, perfeito para aprender ou usar como base.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Como Usar](#como-usar)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Endpoints](#api-endpoints)
- [Banco de Dados](#banco-de-dados)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Visualizar Banco de Dados](#visualizar-banco-de-dados)
- [Funcionalidades](#funcionalidades)
- [Troubleshooting](#troubleshooting)
- [Próximos Passos](#próximos-passos)

## 🎯 Sobre o Projeto {#sobre-o-projeto}

Este projeto é uma aplicação full-stack simples para upload e gerenciamento de imagens. Permite que usuários façam upload de múltiplas imagens simultaneamente, visualizem uma galeria com previews e gerenciem as imagens salvas. Todas as imagens são persistidas em um banco de dados SQLite e armazenadas no servidor.

### Características Principais

- ✅ Interface moderna e responsiva
- ✅ Upload múltiplo de imagens
- ✅ Preview em tempo real
- ✅ Persistência em banco de dados SQLite
- ✅ API REST completa
- ✅ Gerenciamento de imagens (listar, deletar)
- ✅ Visualização do banco de dados

## 🛠 Tecnologias Utilizadas {#tecnologias-utilizadas}

### Frontend
- **React 18.2** - Biblioteca JavaScript para construção de interfaces
- **Vite 5.0** - Build tool e dev server ultra-rápido
- **CSS3** - Estilização moderna e responsiva

### Backend
- **Node.js** - Runtime JavaScript
- **Express 4.18** - Framework web minimalista
- **Multer 1.4** - Middleware para upload de arquivos
- **SQLite3 5.1** - Banco de dados relacional embutido

## 📦 Requisitos {#requisitos}

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 16 ou superior)
- **npm** (geralmente vem com Node.js)

Para verificar se estão instalados:

```bash
node --version
npm --version
```

## 🚀 Instalação {#instalação}

### 1. Clone ou baixe o projeto

Se você já tem o projeto, pule para o próximo passo.

### 2. Instale as dependências

No diretório raiz do projeto, execute:

```bash
npm install
```

Isso instalará todas as dependências listadas no `package.json`:
- Dependências de produção (React, Express, SQLite, etc.)
- Dependências de desenvolvimento (Vite, plugins, etc.)

### 3. Estrutura será criada automaticamente

Quando você iniciar o servidor pela primeira vez, serão criados automaticamente:
- `database.db` - Banco de dados SQLite
- `server/uploads/` - Pasta para armazenar as imagens

## 💻 Como Usar {#como-usar}

### Iniciar o Servidor Backend

Em um terminal, execute:

```bash
npm run server
```

Você verá a mensagem:
```
Servidor rodando em http://localhost:3001
Visualizar banco de dados: http://localhost:3001/db
```

O servidor estará pronto para receber requisições na porta **3001**.

### Iniciar o Frontend

Em **outro terminal**, execute:

```bash
npm run dev
```

Você verá algo como:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Acesse `http://localhost:5173` no seu navegador.

### Usar a Aplicação

1. **Fazer Upload**: Clique no botão "Upload de Imagens" e selecione uma ou múltiplas imagens
2. **Visualizar**: As imagens aparecerão automaticamente na galeria abaixo
3. **Deletar**: Clique no botão "✕" em qualquer imagem para removê-la

## 📁 Estrutura do Projeto {#estrutura-do-projeto}

```
galeria-upload/
│
├── src/                      # Código do frontend React
│   ├── App.jsx              # Componente principal da aplicação
│   ├── App.css              # Estilos do componente App
│   ├── main.jsx             # Ponto de entrada do React
│   └── index.css            # Estilos globais
│
├── server/                   # Código do backend
│   ├── index.js             # Servidor Express e rotas da API
│   └── uploads/              # Pasta de imagens (criada automaticamente)
│       └── [imagens].png    # Arquivos de imagem salvos
│
├── database.db              # Banco de dados SQLite (criado automaticamente)
│
├── view-db.js               # Script para visualizar DB no terminal
├── index.html               # HTML base da aplicação
├── vite.config.js           # Configuração do Vite
├── package.json             # Dependências e scripts do projeto
└── README.md                # Este arquivo
```

## 🔌 API Endpoints {#api-endpoints}

A API REST está disponível em `http://localhost:3001/api`

### POST /api/upload

Faz upload de uma ou múltiplas imagens.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: FormData com campo `images` (array de arquivos)

**Exemplo usando fetch:**
```javascript
const formData = new FormData()
formData.append('images', file1)
formData.append('images', file2)

fetch('http://localhost:3001/api/upload', {
  method: 'POST',
  body: formData
})
```

**Response (sucesso):**
```json
{
  "success": true,
  "images": [
    {
      "id": 1,
      "filename": "1767731482200-549163932.png",
      "originalname": "foto.png",
      "url": "/uploads/1767731482200-549163932.png",
      "mimetype": "image/png",
      "size": 251658
    }
  ]
}
```

**Limitações:**
- Tamanho máximo por arquivo: 10MB
- Apenas arquivos de imagem são aceitos

---

### GET /api/images

Lista todas as imagens salvas no banco de dados.

**Request:**
- Method: `GET`

**Exemplo:**
```javascript
fetch('http://localhost:3001/api/images')
  .then(res => res.json())
  .then(data => console.log(data.images))
```

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "id": 1,
      "filename": "1767731482200-549163932.png",
      "originalname": "foto.png",
      "mimetype": "image/png",
      "size": 251658,
      "created_at": "2024-01-15 10:30:45",
      "url": "/uploads/1767731482200-549163932.png"
    }
  ]
}
```

---

### DELETE /api/images/:id

Deleta uma imagem específica do banco de dados e do servidor.

**Request:**
- Method: `DELETE`
- Parâmetro: `id` (ID da imagem)

**Exemplo:**
```javascript
fetch('http://localhost:3001/api/images/1', {
  method: 'DELETE'
})
```

**Response (sucesso):**
```json
{
  "success": true
}
```

**Response (erro - imagem não encontrada):**
```json
{
  "success": false,
  "error": "Imagem não encontrada"
}
```

---

### GET /db

Visualiza o banco de dados em uma página HTML formatada.

Acesse diretamente no navegador: `http://localhost:3001/db`

## 🗄 Banco de Dados {#banco-de-dados}

### Estrutura da Tabela `images`

O banco de dados SQLite contém uma única tabela:

```sql
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,           -- Nome único do arquivo no servidor
  originalname TEXT NOT NULL,       -- Nome original do arquivo
  mimetype TEXT NOT NULL,           -- Tipo MIME (ex: image/png)
  size INTEGER NOT NULL,            -- Tamanho em bytes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- Data de criação
)
```

### Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | Chave primária, auto-incremento |
| `filename` | TEXT | Nome único gerado para o arquivo (ex: `1767731482200-549163932.png`) |
| `originalname` | TEXT | Nome original do arquivo enviado pelo usuário |
| `mimetype` | TEXT | Tipo MIME do arquivo (ex: `image/png`, `image/jpeg`) |
| `size` | INTEGER | Tamanho do arquivo em bytes |
| `created_at` | DATETIME | Data e hora de criação (formato ISO) |

## 📜 Scripts Disponíveis {#scripts-disponíveis}

Execute os scripts usando `npm run [script]`:

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `npm run dev` | Inicia o servidor de desenvolvimento do Vite (frontend) |
| `build` | `npm run build` | Cria build de produção do frontend |
| `preview` | `npm run preview` | Preview do build de produção |
| `server` | `npm run server` | Inicia o servidor Express (backend) |
| `view-db` | `npm run view-db` | Visualiza o banco de dados no terminal |

## 👁 Visualizar Banco de Dados {#visualizar-banco-de-dados}

Existem três formas de visualizar os dados do banco:

### Opção 1: Página Web (Mais Simples) 🌐

Com o servidor rodando, acesse no navegador:
```
http://localhost:3001/db
```

Mostra uma tabela HTML formatada com:
- Preview das imagens
- Todas as informações de cada registro
- Total de imagens

### Opção 2: Terminal (Node.js) 💻

Execute:
```bash
npm run view-db
```

Ou diretamente:
```bash
node view-db.js
```

Mostra uma saída formatada no terminal com todas as informações.

### Opção 3: DB Browser for SQLite (GUI) 🖥

1. Baixe o [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Abra o arquivo `database.db` na raiz do projeto
3. Visualize e edite os dados diretamente na interface gráfica

## ✨ Funcionalidades {#funcionalidades}

### ✅ Implementadas

- [x] Upload múltiplo de imagens
- [x] Preview das imagens em grid responsivo
- [x] Validação de tipo de arquivo (apenas imagens)
- [x] Persistência em banco de dados SQLite
- [x] Armazenamento físico de arquivos
- [x] Listagem de todas as imagens salvas
- [x] Deletar imagens (banco + arquivo)
- [x] Carregamento automático ao iniciar
- [x] Feedback visual durante upload
- [x] Visualização do banco de dados
- [x] API REST completa
- [x] CORS configurado
- [x] Tratamento de erros

### 🔄 Melhorias Futuras Possíveis

- [ ] Drag & drop para upload
- [ ] Compressão automática de imagens
- [ ] Redimensionamento de imagens
- [ ] Filtros e busca
- [ ] Paginação para muitas imagens
- [ ] Autenticação de usuários
- [ ] Upload para cloud storage (AWS S3, Cloudinary)
- [ ] Suporte a vídeos
- [ ] Galeria em modo lightbox
- [ ] Edição de metadados
- [ ] Tags e categorias

## 🐛 Troubleshooting {#troubleshooting}

### Problema: "Porta já está em uso"

**Solução:** Altere a porta no arquivo `server/index.js`:
```javascript
const PORT = 3002  // ou outra porta disponível
```

### Problema: "Erro ao fazer upload"

**Verificações:**
1. O servidor backend está rodando?
2. O arquivo é uma imagem válida?
3. O tamanho do arquivo está abaixo de 10MB?
4. Verifique os logs do servidor no terminal

### Problema: "Imagens não aparecem"

**Soluções:**
1. Verifique se o servidor está rodando na porta 3001
2. Verifique o console do navegador (F12) para erros
3. Confirme que o proxy está configurado no `vite.config.js`
4. Tente acessar a imagem diretamente: `http://localhost:3001/uploads/[nome-arquivo]`

### Problema: "Banco de dados não encontrado"

**Solução:** O banco será criado automaticamente na primeira execução. Se não criar:
1. Verifique permissões de escrita na pasta
2. Execute o servidor novamente
3. Verifique se há erros no terminal

### Problema: "npm install falha"

**Soluções:**
1. Limpe o cache: `npm cache clean --force`
2. Delete `node_modules` e `package-lock.json`
3. Execute `npm install` novamente
4. Verifique sua versão do Node.js: `node --version` (deve ser 16+)

## 🎓 Próximos Passos {#próximos-passos}

### Para Desenvolvedores

1. **Explorar o código**: Leia os arquivos `src/App.jsx` e `server/index.js`
2. **Modificar estilos**: Edite `src/App.css` para personalizar
3. **Adicionar funcionalidades**: Use a estrutura existente como base
4. **Testar a API**: Use ferramentas como Postman ou Insomnia

### Para Produção

1. Configure variáveis de ambiente
2. Adicione autenticação
3. Configure HTTPS
4. Use um banco de dados mais robusto (PostgreSQL, MySQL)
5. Configure upload para cloud storage
6. Adicione logs e monitoramento
7. Configure rate limiting

## 📝 Licença

Este projeto é de código aberto e está disponível para uso livre.

## 👤 Autor

Desenvolvido como projeto de aprendizado e demonstração.

---

**Dúvidas?** Abra uma issue ou consulte a documentação das tecnologias utilizadas.

**Contribuições são bem-vindas!** 🚀
