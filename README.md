# CNH Simples - PWA Preparatório Oficial CNH

Aplicativo PWA (Progressive Web App) offline-first para preparação da prova teórica de habilitação (CNH) do Brasil, baseado estritamente nas diretrizes oficiais da **Secretaria Nacional de Trânsito (Senatran)**, **Código de Trânsito Brasileiro (CTB)** e **Resoluções do CONTRAN**.

---

## 🚀 Funcionalidades Principais

1. **Simulado Oficial Detran**:
   - 30 questões sorteadas com distribuição oficial por matéria (Legislação, Direção Defensiva, Primeiros Socorros, Meio Ambiente e Mecânica).
   - Cronômetro regressivo de 50 minutos.
   - Critério de aprovação oficial de 70% (mínimo de 21 acertos).
   - Resultado imediato com relatório de erros e acertos.

2. **100% Sem Dependência de IA (Respostas e Justificativas Salvas no Banco)**:
   - Todo o banco de **1.500 questões oficiais** possui o comentário pedagógico, embasamento legal e artigos do CTB / Resoluções CONTRAN embutidos estaticamente.
   - Respostas instantâneas e sem custo de tokens de API ou falhas de conexão.

3. **Caderno de Erros Inteligente (Raio-X)**:
   - Toda questão respondida incorretamente é salva no Caderno de Erros.
   - Modo de treino exclusivo para praticar e gabaritar as questões em que o candidato errou.
   - Ao acertar uma questão no Caderno de Erros, ela é removida da lista.

4. **Tinder de Placas (Flashcards Interativos)**:
   - 146 placas oficiais de trânsito em alta resolução (Regulamentação `R`, Advertência `A`, Indicação e Serviços `SAU`, `DEF`, `TNA`, `THC`).
   - Modo de memorização rápida com swipe/botões "Já sei" ou "Ainda não sei".

5. **Trilha por Módulos Temáticos**:
   - Módulo 1: Sinalização de Trânsito e Vias
   - Módulo 2: Legislação de Trânsito, Infrações e Penalidades
   - Módulo 3: Direção Defensiva e Convivência Segura
   - Módulo 4: Primeiros Socorros, Meio Ambiente e Mecânica Básica

6. **Catálogo Visual de Placas com Filtros**:
   - Consulta rápida com separação por tipo de sinalização vertical.

7. **Termômetro de Aprovação e Métricas**:
   - Taxa de acerto global.
   - Progresso percentual por módulo.

8. **PWA Completo & Offline**:
   - `manifest.json` com ícones para instalação nativa na tela inicial de qualquer smartphone Android ou iPhone.
   - `sw.js` (Service Worker) para cache automático e funcionamento mesmo sem internet.

---

## 🛠️ Como Executar Localmente

### Opção 1: Executar o arquivo `.bat` (Windows)
Basta dar dois cliques no arquivo:
```cmd
iniciar_app.bat
```
Em seguida, abra o navegador em: [http://localhost:8080](http://localhost:8080)

### Opção 2: Linha de comando (Python)
No diretório do projeto, execute:
```bash
python -m http.server 8080
```
E acesse `http://localhost:8080` no navegador.

---

## 📱 Como Instalar no Celular

1. Conecte o celular na mesma rede Wi-Fi do computador e acesse pelo IP local da sua máquina (ex: `http://192.168.1.X:8080`).
2. No Chrome (Android) ou Safari (iOS), clique em **"Adicionar à Tela de Início"** ou **"Instalar Aplicativo"**.
3. O app funcionará em tela cheia como se fosse um aplicativo nativo baixado da Google Play ou App Store.

